import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FONT, radii, spacing, useTheme } from '../theme'
import type { MobileUser } from '../types'

type Guide = { title: string; audience: string; where: string; summary: string; steps: string[] }

const DOM_GUIDES: Guide[] = [
  {
    title: 'Start here: the domiciliary workflow', audience: 'Everyone', where: 'Learn → Domiciliary Care Guide',
    summary: 'Domiciliary care is organised around visits, care plans, call notes, availability, leave, areas, and communication. It is not a residential rota or ward workflow.',
    steps: ['Open Today to see calls due now.', 'Open a client before the visit and review their care plan and risks.', 'Complete visit tasks, check in/out, and write the call note.', 'Escalate anything unsafe, missed, overdue, or outside the care plan.'],
  },
  {
    title: 'Carer: reference a client in the field', audience: 'Carers', where: 'Clients → select a client',
    summary: 'Use the client information cards instead of a horizontal tab strip. Medication and unsupported clinical sections are not part of the domiciliary client view.',
    steps: ['Open Care Plans for agreed support and preferences.', 'Open Risks for current risks and mitigations.', 'Open Body Map for skin or wound observations.', 'Open Documents, Personal, or Contacts when you need supporting information.', 'Use Communication for formal feedback or follow-up; use Chat for operational coordination.'],
  },
  {
    title: 'Carer: complete a visit', audience: 'Carers', where: 'Today or Schedule → tap a call',
    summary: 'The call is the operational record for what happened during a visit. Keep the note factual and person-centred.',
    steps: ['Read the client context and care plan before starting.', 'Use the visit actions and complete the required call tasks.', 'Write what support was provided, the person’s response, and anything to escalate.', 'Check out when complete. If the call is overdue, notify the manager if you cannot safely attend or finish it.'],
  },
  {
    title: 'Carer: availability and annual leave', audience: 'Carers', where: 'Settings → Submit availability / Annual leave',
    summary: 'Availability helps managers plan; it is not a guaranteed shift. Leave overrides the normal availability pattern for the affected dates.',
    steps: ['Submit future availability windows from Submit availability.', 'Use the schedule view to check what you have already submitted.', 'Mark whole days as unavailable when you cannot work.', 'Open Annual leave to see your balance and applied leave, then apply when needed.', 'Keep both availability and leave up to date.'],
  },
  {
    title: 'Manager: review the day', audience: 'Managers', where: 'Team → dashboard / Visits',
    summary: 'Use the manager dashboard to identify missed, overdue, late, disrupted, and unassigned calls before they become safety or service issues.',
    steps: ['Review today’s progress and exceptions.', 'Open a visit to inspect status, notes, disruptions, and incidents.', 'Use Clients to review care plans, risks, body maps, documents, and family communication.', 'Coordinate with carers in Chat and record formal feedback in Communication.', 'Follow your provider’s escalation procedure for safeguarding or urgent concerns.'],
  },
  {
    title: 'Manager: post an open call', audience: 'Managers', where: 'Web: Staffing → Shift Marketplace',
    summary: 'Post an unassigned call so eligible carers can claim it. This creates cover work; it does not replace assigning the actual client visit.',
    steps: ['Open Shift Marketplace on the web.', 'Tap Post open call.', 'Choose the area, start and end time, and call type.', 'Post the call and monitor it in Available Shifts and Claims.', 'After a claim is accepted, confirm the client visit in Call Assignment or Weekly Planner.'],
  },
  {
    title: 'Manager: plan with availability, leave and areas', audience: 'Managers', where: 'Web: Homecare → Availability / Leave Manager / Areas',
    summary: 'Safe planning uses availability, booked leave, existing assignments, travel time, skills, and client needs together.',
    steps: ['Check the carer’s submitted availability.', 'Check approved and pending leave for conflicts.', 'Use Areas to compare active carers and clients by geographic coverage.', 'Assign or reassign the visit only after checking the full context.', 'Use the leave-aware schedule to avoid showing someone as available while on leave.'],
  },
  {
    title: 'When a call is overdue or offline', audience: 'Everyone', where: 'Today or Schedule → the affected call',
    summary: 'A scheduled call changes to Overdue after its start time passes without completion. Offline actions wait for synchronisation.',
    steps: ['Open the overdue call and follow the available visit workflow.', 'Tell the manager if you cannot safely attend or complete it.', 'Use the disruption or incident workflow when appropriate.', 'If offline, reconnect and open Settings → Sync before relying on the action being visible to the team.'],
  },
]

const GENERAL_GUIDES: Guide[] = [
  { title: 'Find your work quickly', audience: 'Everyone', where: 'Today, Schedule, Chat, Settings', summary: 'Your mobile home is role-based: carers focus on calls and schedule; managers focus on team, clients, and visits.', steps: ['Use Today for current work.', 'Use Schedule for upcoming work.', 'Use Chat for coordination.', 'Use Settings for profile, availability, leave, sync, and notifications.'] },
  { title: 'Record safely and escalate', audience: 'Everyone', where: 'Visit → call note / disruption / incident', summary: 'Write factual notes and follow your organisation’s safeguarding and emergency procedures.', steps: ['Record what happened and what support was provided.', 'Do not use a call note as a replacement for a care plan.', 'Escalate urgent safety, safeguarding, or care-plan changes immediately.', 'Use the incident workflow for reportable events.'] },
]

export function LearnScreen({ user, isDomiciliary, onBack }: { user: MobileUser; isDomiciliary: boolean; onBack: () => void }) {
  const { colors: c } = useTheme()
  const [expanded, setExpanded] = useState<string | null>(null)
  const guides = isDomiciliary ? DOM_GUIDES : GENERAL_GUIDES
  const isManager = user.role === 'MANAGER' || user.role === 'ORG_ADMIN'

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: c.primary }]}>LEARNING CENTRE</Text>
          <Text style={[styles.title, { color: c.ink }]}>How to use Meticle Care</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: c.primarySurface, borderColor: c.primary + '25' }]}>
          <Text style={[styles.heroTitle, { color: c.ink }]}>{isDomiciliary ? 'Domiciliary care, in the field' : 'Your mobile workspace'}</Text>
          <Text style={[styles.heroBody, { color: c.muted }]}>Practical guidance for {isManager ? 'managers and carers' : 'carers'} — what to do, where to find it, and when to escalate.</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: c.surface }]}><Text style={[styles.badgeText, { color: c.primary }]}>{isManager ? 'Manager view' : 'Carer view'}</Text></View>
            <View style={[styles.badge, { backgroundColor: c.surface }]}><Text style={[styles.badgeText, { color: c.primary }]}>{isDomiciliary ? 'Domiciliary' : 'Supported living'}</Text></View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: c.subtle }]}>GUIDES</Text>
        {guides.map(guide => {
          const open = expanded === guide.title
          return (
            <View key={guide.title} style={[styles.card, { backgroundColor: c.surface, borderColor: open ? c.primary + '50' : c.borderLight }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open guide ${guide.title}`} onPress={() => setExpanded(open ? null : guide.title)} style={styles.cardButton}>
                <View style={[styles.icon, { backgroundColor: open ? c.primarySurface : c.bg }]}><Ionicons name={open ? 'book' : 'book-outline'} size={19} color={c.primary} /></View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.cardTitle, { color: c.ink }]}>{guide.title}</Text>
                  <Text style={[styles.cardMeta, { color: c.muted }]}>{guide.audience} · {guide.where}</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.subtle} />
              </Pressable>
              {open && <View style={[styles.detail, { borderTopColor: c.borderLight }]}>
                <Text style={[styles.summary, { color: c.ink }]}>{guide.summary}</Text>
                {guide.steps.map((step, index) => <View key={step} style={styles.step}><View style={[styles.stepNo, { backgroundColor: c.primary }]}><Text style={[styles.stepNoText, { color: c.inverse }]}>{index + 1}</Text></View><Text style={[styles.stepText, { color: c.muted }]}>{step}</Text></View>)}
              </View>}
            </View>
          )
        })}
        <Text style={[styles.footer, { color: c.subtle }]}>Always follow your organisation’s policies and emergency procedures. Meticle Care supports documentation and coordination; it does not replace professional judgement.</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: FONT, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontFamily: FONT, fontSize: 19, fontWeight: '800', marginTop: 2 },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  hero: { padding: spacing.base, borderRadius: radii.xl, borderWidth: 1, marginBottom: spacing.xl },
  heroTitle: { fontFamily: FONT, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  heroBody: { fontFamily: FONT, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  badge: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  badgeText: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  sectionLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.sm, paddingLeft: 4 },
  card: { borderRadius: radii.lg, borderWidth: 1, marginBottom: spacing.sm, overflow: 'hidden' },
  cardButton: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  icon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  cardTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  cardMeta: { fontFamily: FONT, fontSize: 11, marginTop: 3, lineHeight: 16 },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  summary: { fontFamily: FONT, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  stepNo: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNoText: { fontFamily: FONT, fontSize: 11, fontWeight: '800' },
  stepText: { flex: 1, fontFamily: FONT, fontSize: 12, lineHeight: 18 },
  footer: { fontFamily: FONT, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: spacing.lg },
})
