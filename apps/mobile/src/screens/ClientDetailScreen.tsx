import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Sharing from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { SkeletonScreen } from '../components/Skeleton'
import { MapPickerModal } from '../components/MapPickerModal'
import type { AuthSession } from '../types'
import {
  getPersonDetail,
  getMedicationsForPerson,
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
}

export function ClientDetailScreen({ personId, session, onBack, onBodyMap, onNutrition }: Props) {
  const c = useAppColors()
  const [person, setPerson] = useState<any>(null)
  const [medications, setMedications] = useState<any[]>([])
  const [bodyMapStats, setBodyMapStats] = useState<any>(null)
  const [nutritionSummary, setNutritionSummary] = useState<any>(null)
  const [records, setRecords] = useState<Record<string, any[]>>({ assessments: [], timeline: [], documents: [], clinicalScores: [], wellbeing: [], capacity: [], pathways: [], communications: [], timeAway: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabKey>('overview')
  const [mapPickerOpen, setMapPickerOpen] = useState(false)
  const [navDest, setNavDest] = useState<{ destination?: string; latitude?: number; longitude?: number; label?: string }>({})
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [personData, medData, bmStats, nutSummary, assessments, timeline, documents, clinicalScores, wellbeing, capacity, pathways, communications, timeAway] = await Promise.all([
        getPersonDetail(session.accessToken, personId),
        getMedicationsForPerson(session.accessToken, personId).catch(() => []),
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
        {tab === 'overview' && <OverviewTab person={person} bodyMapStats={bodyMapStats} nutritionSummary={nutritionSummary} onBodyMap={() => onBodyMap?.(personId, personName)} onNutrition={() => onNutrition?.(personId, personName)} c={c} />}
        {tab === 'care' && <CareTab carePlans={carePlans} allCarePlans={allCarePlans} c={c} />}
        {tab === 'risks' && <RisksTab risks={riskAssessments} c={c} />}
        {tab === 'meds' && <MedsTab medications={medications} c={c} />}
        {tab === 'records' && <RecordsTab records={records} c={c} token={session.accessToken} />}
        {tab === 'personal' && <PersonalTab person={person} c={c} />}
        {tab === 'contacts' && <ContactsTab emergencyContacts={emergencyContacts} otherContacts={otherContacts} c={c} />}
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

/* ─── Tab: Records ───────────────────────────────────────── */

function RecordsTab({ records, c, token }: any) {
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

      <RecordSection title="Care assessments" icon="clipboard-outline" items={records.assessments} c={c} empty="No care assessments" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.assessment_type || 'Care assessment'} meta={formatDate(item.assessment_date)} c={c}>
          {item.assessor_name && <InfoRow icon="person-outline" label="Assessor" value={item.assessor_name} c={c} />}
          {item.findings && <Text style={[styles.recordBody, { color: c.ink }]}>{item.findings}</Text>}
          {item.recommendations && <Text style={[styles.recordBody, { color: c.ink }]}>Recommendations: {item.recommendations}</Text>}
          {item.next_review_date && <InfoRow icon="calendar-outline" label="Next review" value={formatDate(item.next_review_date)} c={c} />}
        </RecordCard>
      )} />

      <RecordSection title="Capacity assessments" icon="people-outline" items={records.capacity} c={c} empty="No capacity assessments" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.decision_to_be_made || 'Capacity assessment'} meta={formatDate(item.assessment_date)} c={c}>
          {item.capacity_status && <InfoRow icon="checkmark-circle-outline" label="Status" value={item.capacity_status} c={c} />}
          {item.capacity_found !== null && item.capacity_found !== undefined && <InfoRow icon="shield-checkmark-outline" label="Capacity found" value={item.capacity_found ? 'Yes' : 'No'} c={c} />}
          {item.best_interest_decision && <Text style={[styles.recordBody, { color: c.ink }]}>Best-interest decision: {item.best_interest_decision}</Text>}
          {item.review_date && <InfoRow icon="calendar-outline" label="Review" value={formatDate(item.review_date)} c={c} />}
        </RecordCard>
      )} />

      <RecordSection title="Care pathways" icon="git-branch-outline" items={records.pathways} c={c} empty="No care pathways" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.title || item.pathway_type || 'Care pathway'} meta={`${item.status || 'active'}${item.start_date ? ` · ${formatDate(item.start_date)}` : ''}`} c={c}>
          {item.location_name && <InfoRow icon="location-outline" label="Location" value={item.location_name} c={c} />}
          {item.referral_reason && <Text style={[styles.recordBody, { color: c.ink }]}>Reason: {item.referral_reason}</Text>}
          {item.discharge_notes && <Text style={[styles.recordBody, { color: c.ink }]}>Notes: {item.discharge_notes}</Text>}
        </RecordCard>
      )} />

      <RecordSection title="Clinical scores" icon="pulse-outline" items={records.clinicalScores} c={c} empty="No clinical scores" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.score_type || 'Clinical score'} meta={formatDate(item.recorded_date)} c={c}>
          <InfoRow icon="analytics-outline" label="Score" value={String(item.score ?? 'Not recorded')} c={c} />
          {item.risk_level && <InfoRow icon="warning-outline" label="Risk" value={item.risk_level} c={c} />}
          {item.notes && <Text style={[styles.recordBody, { color: c.ink }]}>{item.notes}</Text>}
        </RecordCard>
      )} />

      <RecordSection title="Documents" icon="document-attach-outline" items={records.documents} c={c} empty="No documents" renderItem={(item: any) => <DocumentCard key={item.id} item={item} c={c} token={token} />} />

      <RecordSection title="Recent wellbeing" icon="happy-outline" items={records.wellbeing} c={c} empty="No wellbeing records" renderItem={(item: any) => (
        <RecordCard key={item.id} title={item.domain || 'Wellbeing check'} meta={formatDate(item.recorded_date)} c={c}>
          <InfoRow icon="star-outline" label="Score" value={String(item.score ?? 'Not recorded')} c={c} />
          {item.notes && <Text style={[styles.recordBody, { color: c.ink }]}>{item.notes}</Text>}
        </RecordCard>
      )} />

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
