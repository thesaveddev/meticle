import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as Sharing from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { formatDateOnly } from '../utils/dateFormat'
import { SkeletonScreen } from '../components/Skeleton'
import { MapPickerModal } from '../components/MapPickerModal'
import type { AuthSession } from '../types'
import {
  getPersonDetail,
  getMedicationsForPerson,
  logMedicationAdministration,
  getBodyMapStats,
  getDailySummary,
  getPersonAssessments,
  getPersonTimeline,
  getPersonDocuments,
  getPersonClinicalScores,
  getPersonWellbeing,
  getPersonCapacityAssessments,
  getPersonCarePathways,
  getPersonCommunicationLog,
  getPersonTimeAway,
  downloadPersonDocument,
  getApiFileUrl,
  createMedicationItem,
  updateMedicationItem,
} from '../services/api'

type TabKey = 'overview' | 'care' | 'risks' | 'meds' | 'records' | 'personal' | 'contacts'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'document-text-outline' },
  { key: 'care', label: 'Care Plans', icon: 'clipboard-outline' },
  { key: 'risks', label: 'Risks', icon: 'shield-outline' },
  { key: 'meds', label: 'Meds', icon: 'medkit-outline' },
  { key: 'records', label: 'Records', icon: 'library-outline' },
  { key: 'personal', label: 'Personal', icon: 'person-outline' },
  { key: 'contacts', label: 'Contacts', icon: 'call-outline' },
]

interface Props {
  personId: string
  session: AuthSession
  onBack: () => void
  onBodyMap?: (personId: string, personName: string) => void
  onNutrition?: (personId: string, personName: string) => void
  onOpenSection?: (personId: string, section: TabKey) => void
  initialTab?: TabKey
  sectionOnly?: boolean
}

export function ClientDetailScreen({ personId, session, onBack, onBodyMap, onNutrition, onOpenSection, initialTab = 'overview', sectionOnly = false }: Props) {
  const c = useAppColors()
  const [person, setPerson] = useState<any>(null)
  const [medications, setMedications] = useState<any[]>([])
  const [bodyMapStats, setBodyMapStats] = useState<any>(null)
  const [nutritionSummary, setNutritionSummary] = useState<any>(null)
  const [records, setRecords] = useState<Record<string, any[]>>({ assessments: [], timeline: [], documents: [], clinicalScores: [], wellbeing: [], capacity: [], pathways: [], communications: [], timeAway: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [mapPickerOpen, setMapPickerOpen] = useState(false)
  const [navDest, setNavDest] = useState<{ destination?: string; latitude?: number; longitude?: number; label?: string }>({})
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const isDomiciliary = (session.organization?.service_types || []).some(type => ['domiciliary', 'live_in'].includes(type))
      // Medication is a supported-living workflow. Domiciliary clients must
      // not attempt the endpoint or show a medication tab in the mobile app.
      const medicationEnabled = !isDomiciliary
      const [personData, medData, bmStats, nutSummary, assessments, timeline, documents, clinicalScores, wellbeing, capacity, pathways, communications, timeAway] = await Promise.all([
        getPersonDetail(session.accessToken, personId),
        medicationEnabled ? getMedicationsForPerson(session.accessToken, personId).catch(() => []) : Promise.resolve([]),
        getBodyMapStats(session.accessToken, personId).catch(() => null),
        getDailySummary(session.accessToken, personId).catch(() => null),
        getPersonAssessments(session.accessToken, personId).catch(() => []),
        getPersonTimeline(session.accessToken, personId).catch(() => []),
        getPersonDocuments(session.accessToken, personId).catch(() => []),
        getPersonClinicalScores(session.accessToken, personId).catch(() => []),
        getPersonWellbeing(session.accessToken, personId).catch(() => []),
        getPersonCapacityAssessments(session.accessToken, personId).catch(() => []),
        getPersonCarePathways(session.accessToken, personId).catch(() => []),
        getPersonCommunicationLog(session.accessToken, personId).catch(() => []),
        getPersonTimeAway(session.accessToken, personId).catch(() => []),
      ])
      setPerson(personData)
      setMedications(medData)
      setBodyMapStats(bmStats)
      setNutritionSummary(nutSummary)
      setRecords({ assessments, timeline, documents, clinicalScores, wellbeing, capacity, pathways, communications, timeAway })
    } catch (e: any) {
      setError(e.message || 'Could not load details')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session.accessToken, personId])
  useEffect(() => { loadData() }, [loadData])

  // Opening a section reuses this same screen instance rather than mounting a
  // fresh one, so the tab has to follow the requested section. Reading
  // initialTab only as useState's initial value left every section showing the
  // overview, because that first render always resolved to 'overview'.
  useEffect(() => { setTab(initialTab) }, [initialTab, personId])

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
  const isDomiciliary = (session.organization?.service_types || []).some(type => ['domiciliary', 'live_in'].includes(type))
  const visibleTabs = isDomiciliary ? TABS.filter(item => item.key !== 'meds') : TABS
  const allergies = typeof person.allergies === 'string' ? JSON.parse(person.allergies || '[]') : (person.allergies || [])
  const carePlans = (person.care_plans || []).filter((cp: any) => cp.status === 'active')
  const allCarePlans = person.care_plans || []
  const contacts = person.family_contacts || []
  const emergencyContacts = contacts.filter((ct: any) => ct.is_emergency_contact)
  const otherContacts = contacts.filter((ct: any) => !ct.is_emergency_contact)
  const riskAssessments = person.risk_assessments || []
  const highRisks = riskAssessments.filter((r: any) => r.risk_level === 'high' || r.risk_level === 'critical')
  const activeTabLabel = visibleTabs.find(item => item.key === tab)?.label || 'Overview'

  if (sectionOnly) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Header onBack={onBack} title={activeTabLabel} c={c} />
        <View style={[styles.sectionPageHeader, { backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
          <Text style={[styles.sectionPageClient, { color: c.muted }]}>{personName}</Text>
          <Text style={[styles.sectionPageTitle, { color: c.ink }]}>{activeTabLabel}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData() }} tintColor="transparent" />}>
          {tab === 'overview' && <OverviewTab person={person} bodyMapStats={bodyMapStats} nutritionSummary={nutritionSummary} onBodyMap={() => onBodyMap?.(personId, personName)} onNutrition={() => onNutrition?.(personId, personName)} c={c} />}
          {tab === 'care' && <CareTab carePlans={carePlans} allCarePlans={allCarePlans} c={c} />}
          {tab === 'risks' && <RisksTab risks={riskAssessments} c={c} />}
          {tab === 'meds' && <MedsTab medications={medications} c={c} />}
          {tab === 'records' && <RecordsTab records={records} c={c} token={session.accessToken} domiciliary={isDomiciliary} />}
          {tab === 'personal' && <PersonalTab person={person} c={c} />}
          {tab === 'contacts' && <ContactsTab emergencyContacts={emergencyContacts} otherContacts={otherContacts} c={c} />}
        </ScrollView>
      </View>
    )
  }

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
              <Text style={[styles.quickStatText, { color: c.muted }]}>{formatDateOnly(person.date_of_birth)}</Text>
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
              DNACPR: {person.dnacpr_status}{person.dnacpr_date ? ` (${formatDateOnly(person.dnacpr_date)})` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Client sections — cards are more reliable than a horizontal tab strip on small screens. */}
      <View style={[styles.sectionPicker, { backgroundColor: c.surface }]}>
        <Text style={[styles.sectionPickerTitle, { color: c.ink }]}>Client information</Text>
        <Text style={[styles.sectionPickerHint, { color: c.muted }]}>Choose a section to view the latest records.</Text>
        <View style={styles.sectionCardGrid}>
          {visibleTabs.map(t => {
            const count = t.key === 'care' ? allCarePlans.length : t.key === 'risks' ? riskAssessments.length : t.key === 'meds' ? medications.length : undefined
            return (
              <Pressable
                key={t.key}
                accessibilityRole="button"
                accessibilityLabel={`Open ${t.label}`}
                onPress={() => onOpenSection?.(personId, t.key)}
                style={({ pressed }) => [styles.sectionCard, { backgroundColor: tab === t.key ? c.primarySurface : c.surfaceAlt, borderColor: tab === t.key ? c.primary + '55' : c.borderLight }, pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] }]}
              >
                <View style={[styles.sectionCardIcon, { backgroundColor: tab === t.key ? c.surface : c.surface }]}>
                  <Ionicons name={t.icon as any} size={19} color={tab === t.key ? c.primary : c.muted} />
                </View>
                <View style={styles.sectionCardCopy}>
                  <Text style={[styles.sectionCardLabel, { color: tab === t.key ? c.primary : c.ink }]}>{t.label}</Text>
                  {count !== undefined && <Text style={[styles.sectionCardCount, { color: c.muted }]}>{count} {count === 1 ? 'record' : 'records'}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={16} color={tab === t.key ? c.primary : c.subtle} />
              </Pressable>
            )
          })}
        </View>
      </View>

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

function OverviewTab({ person, bodyMapStats, nutritionSummary, onBodyMap, onNutrition, c }: any) {
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
          {cp.review_date && <InfoRow icon="calendar-outline" label="Review" value={formatDateOnly(cp.review_date)} c={c} />}
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

/* ─── Tab: Records ───────────────────────────────────────── */

function RecordsTab({ records, c, token, domiciliary }: any) {
  const total = Object.values(records).reduce((count: number, items: any) => count + (Array.isArray(items) ? items.length : 0), 0)
  if (total === 0) {
    return <EmptyState icon="library-outline" title="No additional records" subtitle="Assessments, documents and other records will appear here" c={c} />
  }
  return (
    <View>
      <View style={[styles.recordsIntro, { backgroundColor: c.primarySurface }]}>
        <Ionicons name="information-circle-outline" size={18} color={c.primary} />
        <Text style={[styles.recordsIntroText, { color: c.primary }]}>Read-only client records. Use the web app for clinical updates and document management.</Text>
      </View>

      {!domiciliary && <RecordSection title="Care assessments" icon="clipboard-outline" items={records.assessments} c={c} empty="No care assessments" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.assessment_type || 'Care assessment'} meta={formatDate(item.assessment_date)} c={c}>
          {item.assessor_name && <InfoRow icon="person-outline" label="Assessor" value={item.assessor_name} c={c} />}
          {item.findings && <Text style={[styles.recordBody, { color: c.ink }]}>{item.findings}</Text>}
          {item.recommendations && <Text style={[styles.recordBody, { color: c.ink }]}>Recommendations: {item.recommendations}</Text>}
          {item.next_review_date && <InfoRow icon="calendar-outline" label="Next review" value={formatDate(item.next_review_date)} c={c} />}
        </RecordCard>
      )} />}

      {!domiciliary && <RecordSection title="Capacity assessments" icon="people-outline" items={records.capacity} c={c} empty="No capacity assessments" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.decision_to_be_made || 'Capacity assessment'} meta={formatDate(item.assessment_date)} c={c}>
          {item.capacity_status && <InfoRow icon="checkmark-circle-outline" label="Status" value={item.capacity_status} c={c} />}
          {item.capacity_found !== null && item.capacity_found !== undefined && <InfoRow icon="shield-checkmark-outline" label="Capacity found" value={item.capacity_found ? 'Yes' : 'No'} c={c} />}
          {item.best_interest_decision && <Text style={[styles.recordBody, { color: c.ink }]}>Best-interest decision: {item.best_interest_decision}</Text>}
          {item.review_date && <InfoRow icon="calendar-outline" label="Review" value={formatDate(item.review_date)} c={c} />}
        </RecordCard>
      )} />}

      <RecordSection title="Care pathways" icon="git-branch-outline" items={records.pathways} c={c} empty="No care pathways" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.title || item.pathway_type || 'Care pathway'} meta={`${item.status || 'active'}${item.start_date ? ` · ${formatDate(item.start_date)}` : ''}`} c={c}>
          {item.location_name && <InfoRow icon="location-outline" label="Location" value={item.location_name} c={c} />}
          {item.referral_reason && <Text style={[styles.recordBody, { color: c.ink }]}>Reason: {item.referral_reason}</Text>}
          {item.discharge_notes && <Text style={[styles.recordBody, { color: c.ink }]}>Notes: {item.discharge_notes}</Text>}
        </RecordCard>
      )} />

      {!domiciliary && <RecordSection title="Clinical scores" icon="pulse-outline" items={records.clinicalScores} c={c} empty="No clinical scores" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.score_type || 'Clinical score'} meta={formatDate(item.recorded_date)} c={c}>
          <InfoRow icon="analytics-outline" label="Score" value={String(item.score ?? 'Not recorded')} c={c} />
          {item.risk_level && <InfoRow icon="warning-outline" label="Risk" value={item.risk_level} c={c} />}
          {item.notes && <Text style={[styles.recordBody, { color: c.ink }]}>{item.notes}</Text>}
        </RecordCard>
      )} />}

      <RecordSection title="Documents" icon="document-attach-outline" items={records.documents} c={c} empty="No documents" renderItem={(item: any) => <DocumentCard key={item.id} item={item} c={c} token={token} />} />

      {!domiciliary && <RecordSection title="Recent wellbeing" icon="happy-outline" items={records.wellbeing} c={c} empty="No wellbeing records" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.domain || 'Wellbeing check'} meta={formatDate(item.recorded_date)} c={c}>
          <InfoRow icon="star-outline" label="Score" value={String(item.score ?? 'Not recorded')} c={c} />
          {item.notes && <Text style={[styles.recordBody, { color: c.ink }]}>{item.notes}</Text>}
        </RecordCard>
      )} />}

      <RecordSection title="Communication history" icon="chatbubbles-outline" items={records.communications} c={c} empty="No communication history" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.contact_name || 'Communication'} meta={formatDate(item.recorded_date)} c={c}>
          {item.relationship && <InfoRow icon="people-outline" label="Relationship" value={item.relationship} c={c} />}
          {item.contact_method && <InfoRow icon="call-outline" label="Method" value={item.contact_method} c={c} />}
          {item.summary && <Text style={[styles.recordBody, { color: c.ink }]}>{item.summary}</Text>}
          {item.follow_up_actions && <Text style={[styles.recordBody, { color: c.ink }]}>Follow-up: {item.follow_up_actions}</Text>}
        </RecordCard>
      )} />

      <RecordSection title="Time away & discharge" icon="exit-outline" items={records.timeAway} c={c} empty="No time-away records" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.title || item.time_away_type || 'Time away'} meta={`${item.start_date ? formatDate(item.start_date) : ''}${item.end_date ? ` – ${formatDate(item.end_date)}` : ''}`} c={c}>
          {item.destination && <InfoRow icon="location-outline" label="Destination" value={item.destination} c={c} />}
          {item.notes && <Text style={[styles.recordBody, { color: c.ink }]}>{item.notes}</Text>}
          {Array.isArray(item.items) && item.items.length > 0 && <Text style={[styles.recordMeta, { color: c.muted }]}>{item.items.filter((i: any) => i.is_complete).length} of {item.items.length} checklist items complete</Text>}
        </RecordCard>
      )} />

      {records.timeline.length > 0 && (
        <RecordSection title="Activity timeline" icon="time-outline" items={records.timeline.slice(0, 20)} c={c} empty="No activity" renderItem={(item: any) => (
          <View key={item.id || `${item.event_type}-${item.created_at}`} style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: c.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.recordTitle, { color: c.ink }]}>{item.title || item.description || item.event_type || 'Activity'}</Text>
              <Text style={[styles.recordMeta, { color: c.muted }]}>{formatDate(item.created_at || item.event_date)}</Text>
            </View>
          </View>
        )} />
      )}
    </View>
  )
}

function DocumentCard({ item, c, token }: { item: any; c: any; token: string }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileName = item.file_name || item.file_url?.split('/').pop() || 'client-document'
  const mimeType = item.mime_type || ''
  const isImage = mimeType.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(fileName)

  const download = async () => {
    if (!item.file_url) return
    setBusy(true)
    try {
      const file = await downloadPersonDocument(token, item.file_url, fileName)
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Document downloaded', 'The document is available in the app cache, but sharing is not available on this device.')
        return
      }
      await Sharing.shareAsync(file.uri, { mimeType: mimeType || (isImage ? 'image/*' : 'application/octet-stream'), dialogTitle: 'Open or save document' })
    } catch (error: any) {
      Alert.alert('Document unavailable', error?.message || 'Could not download this document.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <RecordCard title={item.title || 'Untitled document'} meta={`${item.document_type || 'Document'}${item.upload_date ? ` · ${formatDate(item.upload_date)}` : ''}`} c={c}>
        {item.description && <Text style={[styles.recordBody, { color: c.ink }]}>{item.description}</Text>}
        {item.uploaded_by_name && <Text style={[styles.recordMeta, { color: c.muted }]}>Uploaded by {item.uploaded_by_name}</Text>}
        {item.file_url ? (
          <View style={styles.documentActions}>
            {isImage && <Pressable onPress={() => setPreviewOpen(true)} disabled={busy} style={[styles.documentButton, { backgroundColor: c.primarySurface }]}><Ionicons name="eye-outline" size={15} color={c.primary} /><Text style={[styles.documentButtonText, { color: c.primary }]}>Preview</Text></Pressable>}
            <Pressable onPress={download} disabled={busy} style={[styles.documentButton, { backgroundColor: c.surfaceAlt }]}><Ionicons name="download-outline" size={15} color={c.ink} /><Text style={[styles.documentButtonText, { color: c.ink }]}>{busy ? 'Opening…' : isImage ? 'Save' : 'Open / save'}</Text></Pressable>
          </View>
        ) : <Text style={[styles.recordMeta, { color: c.muted }]}>No file attached</Text>}
      </RecordCard>
      <Modal visible={previewOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.documentPreview}>
          <View style={styles.documentPreviewHeader}>
            <Pressable onPress={() => setPreviewOpen(false)} accessibilityRole="button" accessibilityLabel="Close document preview"><Ionicons name="close" size={28} color="#FFFFFF" /></Pressable>
            <Text style={styles.documentPreviewTitle} numberOfLines={1}>{fileName}</Text>
            <Pressable onPress={download} disabled={busy} accessibilityRole="button" accessibilityLabel="Save document"><Ionicons name="download-outline" size={24} color="#FFFFFF" /></Pressable>
          </View>
          <Image source={{ uri: getApiFileUrl(item.file_url), headers: { Authorization: `Bearer ${token}` } }} style={styles.documentPreviewImage} resizeMode="contain" />
        </View>
      </Modal>
    </>
  )
}

function RecordSection({ title, icon: _icon, items, empty, renderItem, c }: any) {
  return (
    <Card title={title} c={c}>
      {items.length === 0 ? <Text style={[styles.emptyText, { color: c.muted }]}>{empty}</Text> : items.map(renderItem)}
    </Card>
  )
}

function RecordCard({ title, meta, children, c }: any) {
  return (
    <View style={[styles.recordCard, { borderTopColor: c.borderLight }]}>
      <Text style={[styles.recordTitle, { color: c.ink }]}>{title}</Text>
      {meta ? <Text style={[styles.recordMeta, { color: c.muted }]}>{meta}</Text> : null}
      {children}
    </View>
  )
}

function formatDate(value?: string | null) {
  if (!value) return 'Date not recorded'
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDateOnly(value, 'Date not recorded')
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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
          <View key={risk.id} style={[styles.riskCard, { backgroundColor: c.surface }]}>
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
            {risk.review_date && <Text style={[styles.riskReview, { color: c.muted }]}>Review: {formatDateOnly(risk.review_date)}</Text>}
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

function _MedicationRecordCard({ record, token, c, onChanged }: any) {
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [editor, setEditor] = useState({ name: '', dosage: '', unit: '', route: '', frequency: '', instructions: '', start_date: '', end_date: '', reason_for_change: '' })
  const [editorSaving, setEditorSaving] = useState(false)
  const items = Array.isArray(record.items) ? record.items.filter((item: any) => item.is_active !== false) : []

  const recordDose = (item: any, status: 'given' | 'refused' | 'missed') => {
    const label = status === 'given' ? 'given' : status === 'refused' ? 'refused' : 'not given'
    Alert.alert(`Mark ${label}`, `${item.name || item.medication_name} — ${item.dosage || ''}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Mark ${label}`, style: status === 'given' ? 'default' : 'destructive', onPress: async () => {
        setBusyItem(item.id)
        try {
          await logMedicationAdministration(token, {
            emedication_item_id: item.id,
            scheduled_time: new Date().toISOString(),
            status,
          })
          Alert.alert('Saved', `Medication marked ${label}.`)
        } catch (error: any) {
          Alert.alert('Could not save', error?.message || 'Check medication competency and try again.')
        } finally {
          setBusyItem(null)
        }
      } },
    ])
  }

  const publishChange = () => {
    if (!editor.name.trim() || !editor.dosage.trim() || !editor.frequency.trim() || !editor.start_date || !editor.end_date || !editor.reason_for_change.trim()) {
      Alert.alert('Complete the change', 'Name, dosage, frequency, effective dates and a reason are required before publishing.')
      return
    }
    if (editor.end_date < editor.start_date) {
      Alert.alert('Check the dates', 'The end date cannot be before the effective start date.')
      return
    }
    const action = editingItem?.isNew ? 'add this medication to' : 'publish these changes to'
    Alert.alert('Confirm MAR change', `Are you sure you want to ${action} ${record.title || 'the MAR'}? This will be audited under your account.`, [
      { text: 'Review again', style: 'cancel' },
      { text: 'Publish change', onPress: async () => {
        setEditorSaving(true)
        try {
          const payload = { ...editor, name: editor.name.trim(), dosage: editor.dosage.trim(), reason_for_change: editor.reason_for_change.trim() }
          if (editingItem?.isNew) await createMedicationItem(token, record.id, payload)
          else await updateMedicationItem(token, editingItem.id, payload)
          setEditingItem(null)
          Alert.alert('MAR updated', 'The medication change was published and recorded in the audit trail.')
          await onChanged?.()
        } catch (error: any) {
          Alert.alert('Could not publish', error?.message || 'The MAR was not changed.')
        } finally { setEditorSaving(false) }
      } },
    ])
  }

  return (
    <Card title={record.title || 'Medication record'} c={c}>
      <Text style={[styles.recordMeta, { color: c.muted }]}>{record.status || 'active'}{record.start_date ? ` · ${formatDate(record.start_date)}` : ''}{record.end_date ? ` – ${formatDate(record.end_date)}` : ''}</Text>
      {items.length === 0 ? <Text style={[styles.emptyText, { color: c.muted }]}>No medication items on this record.</Text> : items.map((item: any) => (
        <View key={item.id} style={[styles.medItem, { borderTopColor: c.borderLight }]}>
          <View style={[styles.medIcon, { backgroundColor: c.primarySurface }]}><Ionicons name="medkit" size={18} color={c.primary} /></View>
          <View style={styles.medItemCopy}>
            <Text style={[styles.medName, { color: c.ink }]}>{item.name || item.medication_name}</Text>
            <Text style={[styles.medDetail, { color: c.muted }]}>{item.dosage || 'Dose not recorded'}{item.unit ? ` ${item.unit}` : ''}{item.frequency ? ` · ${item.frequency}` : ''}</Text>
            {item.route && <Text style={[styles.medDetail, { color: c.muted }]}>Route: {item.route}</Text>}
            {item.instructions && <Text style={[styles.medDetail, { color: c.muted }]}>{item.instructions}</Text>}
            <View style={styles.medActions}>
              <Pressable disabled={busyItem === item.id} onPress={() => recordDose(item, 'given')} style={[styles.medAction, { backgroundColor: c.successSurface }]}><Ionicons name="checkmark" size={14} color={c.successDeep} /><Text style={[styles.medActionText, { color: c.successDeep }]}>{busyItem === item.id ? 'Saving…' : 'Given'}</Text></Pressable>
              <Pressable disabled={busyItem === item.id} onPress={() => recordDose(item, 'refused')} style={[styles.medAction, { backgroundColor: c.warningSurface }]}><Ionicons name="close" size={14} color={c.warning} /><Text style={[styles.medActionText, { color: c.warning }]}>Refused</Text></Pressable>
              <Pressable disabled={busyItem === item.id} onPress={() => recordDose(item, 'missed')} style={[styles.medAction, { backgroundColor: c.dangerSurface }]}><Ionicons name="alert-outline" size={14} color={c.danger} /><Text style={[styles.medActionText, { color: c.danger }]}>Not given</Text></Pressable>

            </View>
          </View>
        </View>
      ))}

      {editingItem && <Modal visible animationType="slide" transparent onRequestClose={() => !editorSaving && setEditingItem(null)}>
        <View style={styles.modalBackdrop}><View style={[styles.editorSheet, { backgroundColor: c.surface }]}>
          <View style={styles.editorHeader}><View style={{ flex: 1 }}><Text style={[styles.editorTitle, { color: c.ink }]}>{editingItem.isNew ? 'Add medication' : 'Edit medication'}</Text><Text style={[styles.editorSubtitle, { color: c.muted }]}>Manager-only · changes are audited</Text></View><Pressable disabled={editorSaving} onPress={() => setEditingItem(null)}><Ionicons name="close" size={24} color={c.ink} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.editorLabel, { color: c.ink }]}>Medication name</Text><TextInput value={editor.name} onChangeText={value => setEditor(prev => ({ ...prev, name: value }))} placeholder="e.g. Paracetamol" placeholderTextColor={c.subtle} style={[styles.editorInput, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} />
            <View style={styles.editorRow}><View style={{ flex: 1 }}><Text style={[styles.editorLabel, { color: c.ink }]}>Dosage</Text><TextInput value={editor.dosage} onChangeText={value => setEditor(prev => ({ ...prev, dosage: value }))} placeholder="e.g. 500" placeholderTextColor={c.subtle} style={[styles.editorInput, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} /></View><View style={{ flex: 1 }}><Text style={[styles.editorLabel, { color: c.ink }]}>Unit</Text><TextInput value={editor.unit} onChangeText={value => setEditor(prev => ({ ...prev, unit: value }))} placeholder="mg" placeholderTextColor={c.subtle} style={[styles.editorInput, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} /></View></View>
            <View style={styles.editorRow}><View style={{ flex: 1 }}><Text style={[styles.editorLabel, { color: c.ink }]}>Route</Text><TextInput value={editor.route} onChangeText={value => setEditor(prev => ({ ...prev, route: value }))} placeholder="oral" placeholderTextColor={c.subtle} style={[styles.editorInput, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} /></View><View style={{ flex: 1 }}><Text style={[styles.editorLabel, { color: c.ink }]}>Frequency</Text><TextInput value={editor.frequency} onChangeText={value => setEditor(prev => ({ ...prev, frequency: value }))} placeholder="once daily" placeholderTextColor={c.subtle} style={[styles.editorInput, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} /></View></View>
            <View style={styles.editorRow}><View style={{ flex: 1 }}><Text style={[styles.editorLabel, { color: c.ink }]}>Effective from</Text><TextInput value={editor.start_date} onChangeText={value => setEditor(prev => ({ ...prev, start_date: value }))} placeholder="YYYY-MM-DD" placeholderTextColor={c.subtle} style={[styles.editorInput, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} /></View><View style={{ flex: 1 }}><Text style={[styles.editorLabel, { color: c.ink }]}>Effective until</Text><TextInput value={editor.end_date} onChangeText={value => setEditor(prev => ({ ...prev, end_date: value }))} placeholder="YYYY-MM-DD" placeholderTextColor={c.subtle} style={[styles.editorInput, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} /></View></View>
            <Text style={[styles.editorLabel, { color: c.ink }]}>Instructions</Text><TextInput value={editor.instructions} onChangeText={value => setEditor(prev => ({ ...prev, instructions: value }))} placeholder="Administration instructions" placeholderTextColor={c.subtle} multiline style={[styles.editorInput, styles.editorNotes, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} />
            <Text style={[styles.editorLabel, { color: c.ink }]}>Reason for change <Text style={{ color: c.danger }}>*</Text></Text><TextInput value={editor.reason_for_change} onChangeText={value => setEditor(prev => ({ ...prev, reason_for_change: value }))} placeholder="Why is this medication being changed?" placeholderTextColor={c.subtle} multiline style={[styles.editorInput, styles.editorNotes, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} />
            <View style={[styles.auditNotice, { backgroundColor: c.warningSurface }]}><Ionicons name="shield-checkmark-outline" size={17} color={c.warning} /><Text style={[styles.auditNoticeText, { color: c.warning }]}>Publishing records the effective dates and your reason in the medication audit trail.</Text></View>
            <Pressable disabled={editorSaving} onPress={publishChange} style={[styles.publishButton, { backgroundColor: c.primary, opacity: editorSaving ? 0.6 : 1 }]}><Text style={[styles.publishButtonText, { color: c.inverse }]}>{editorSaving ? 'Publishing…' : 'Review and publish'}</Text></Pressable>
          </ScrollView>
        </View></View>
      </Modal>}
    </Card>
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
        {person.admission_date && <InfoRow icon="calendar-outline" label="Admitted" value={formatDateOnly(person.admission_date)} c={c} />}
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
        {person.discharge_date && <InfoRow icon="calendar-outline" label="Date" value={formatDateOnly(person.discharge_date)} c={c} />}
        {person.discharge_reason && <InfoRow icon="alert-circle-outline" label="Reason" value={person.discharge_reason} c={c} />}
        {person.discharge_destination && <InfoRow icon="location-outline" label="Destination" value={person.discharge_destination} c={c} />}
        {person.discharge_summary && <Text style={[styles.cardBody, { color: c.ink, marginTop: spacing.xs }]}>{person.discharge_summary}</Text>}
        {!person.discharge_date && <Text style={[styles.emptyText, { color: c.muted }]}>No discharge information</Text>}
      </Card>

      <Card title="Advance Decisions" c={c}>
        {person.advance_decision && <InfoRow icon="document-text-outline" label="Decision" value={person.advance_decision} c={c} />}
        {person.advance_decision_date && <InfoRow icon="calendar-outline" label="Date" value={formatDateOnly(person.advance_decision_date)} c={c} />}
        {person.dnacpr_status && <InfoRow icon="heart-dislike-outline" label="DNACPR" value={`${person.dnacpr_status}${person.dnacpr_date ? ` (${formatDateOnly(person.dnacpr_date)})` : ''}`} c={c} />}
        {person.dnacpr_review_date && <InfoRow icon="calendar-outline" label="DNACPR review" value={formatDateOnly(person.dnacpr_review_date)} c={c} />}
        {person.dnacpr_details && <Text style={[styles.cardBody, { color: c.ink, marginTop: spacing.xs }]}>{person.dnacpr_details}</Text>}
        {!person.advance_decision && !person.dnacpr_status && <Text style={[styles.emptyText, { color: c.muted }]}>No advance decisions recorded</Text>}
      </Card>
    </View>
  )
}

/* ─── Tab: Contacts ──────────────────────────────────────── */

function ContactsTab({ emergencyContacts, otherContacts, c }: any) {
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

  /* Section picker */
  sectionPicker: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  sectionPageHeader: { paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionPageClient: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  sectionPageTitle: { fontFamily: FONT, fontSize: 22, fontWeight: '800', marginTop: 2 },
  sectionPickerTitle: { fontSize: 16, fontWeight: '700', fontFamily: FONT },
  sectionPickerHint: { fontSize: 12, fontFamily: FONT, marginTop: 3, marginBottom: spacing.sm },
  sectionCardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  sectionCard: { width: '48%', minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, borderWidth: 1 },
  sectionCardIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sectionCardCopy: { flex: 1, minWidth: 0 },
  sectionCardLabel: { fontSize: 12, fontWeight: '700', fontFamily: FONT },
  sectionCardCount: { fontSize: 10, fontFamily: FONT, marginTop: 2 },

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

  /* Records */
  recordsIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md },
  recordsIntroText: { flex: 1, fontSize: 13, fontFamily: FONT, lineHeight: 18 },
  recordCard: { paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  recordTitle: { fontSize: 14, fontWeight: '600', fontFamily: FONT },
  recordMeta: { fontSize: 12, fontFamily: FONT, marginTop: 2 },
  recordBody: { fontSize: 13, fontFamily: FONT, lineHeight: 19, marginTop: spacing.xs },
  documentActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  documentButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md },
  documentButtonText: { fontSize: 12, fontWeight: '600', fontFamily: FONT },
  documentPreview: { flex: 1, backgroundColor: '#000000' },
  documentPreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.base, paddingVertical: spacing.md },
  documentPreviewTitle: { flex: 1, marginHorizontal: spacing.md, color: '#FFFFFF', fontSize: 15, fontWeight: '600', fontFamily: FONT, textAlign: 'center' },
  documentPreviewImage: { flex: 1, width: '100%' },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },

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
  medItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingTop: spacing.md, marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  medItemCopy: { flex: 1, minWidth: 0 },
  medIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  medName: { fontSize: 15, fontWeight: '600', fontFamily: FONT },
  medDetail: { fontSize: 13, fontFamily: FONT, marginTop: 2 },
  medActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  medAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.sm },
  medActionText: { fontSize: 11, fontWeight: '700', fontFamily: FONT },
  addMedicationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radii.md, paddingVertical: spacing.sm, marginTop: spacing.md },
  addMedicationText: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  editorSheet: { maxHeight: '92%', borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingTop: spacing.base },
  editorHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  editorTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  editorSubtitle: { fontFamily: FONT, fontSize: 12, marginTop: 3 },
  editorContent: { padding: spacing.base, paddingBottom: spacing.xxxl },
  editorRow: { flexDirection: 'row', gap: spacing.sm },
  editorLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  editorInput: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: FONT, fontSize: 14 },
  editorNotes: { minHeight: 74, textAlignVertical: 'top' },
  auditNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, marginTop: spacing.md },
  auditNoticeText: { flex: 1, fontFamily: FONT, fontSize: 12, lineHeight: 17 },
  publishButton: { alignItems: 'center', borderRadius: radii.md, paddingVertical: spacing.md, marginTop: spacing.lg },
  publishButtonText: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },

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
