import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { PrimaryButton } from '../components/PrimaryButton'
import { SkeletonInline } from '../components/Skeleton'
import { claimOpenCall, getOpenCalls, type OpenCall } from '../services/api'
import { hapticLight, hapticWarning } from '../services/haptics'
import type { AuthSession } from '../types'

interface Props {
  session: AuthSession
  onBack: () => void
}

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function durationLabel(start: string, end: string) {
  const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3600000
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`
}

const SHIFT_TYPE_LABEL: Record<string, string> = {
  day: 'Day',
  sleep: 'Sleep-in',
  wake_night: 'Wake night',
}

/**
 * Open calls: extra shifts a care worker can pick up.
 *
 * The list comes from `GET /shifts/open`, which returns published, unclaimed
 * shifts for the next fortnight. Claiming posts to `/shifts/:id/claim`, where
 * the backend works out who is claiming from the session, so there is no way to
 * claim on someone else's behalf from the phone.
 *
 * A claim is not always immediate. Unless the claimant manages the location in
 * question — which auto-approves — the claim is held for a manager, and the
 * screen says so rather than implying the extra shift is already the user's.
 */
export function OpenCallsScreen({ session, onBack }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [calls, setCalls] = useState<OpenCall[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await getOpenCalls(session.accessToken)
      setCalls(Array.isArray(data) ? data : [])
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Could not load open calls.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session.accessToken])

  useEffect(() => { load() }, [load])

  const handleClaim = (call: OpenCall) => {
    const when = `${dateLabel(call.start_time)}, ${time(call.start_time)}–${time(call.end_time)}`
    Alert.alert(
      'Claim this call?',
      `${when} · ${call.location_name || 'Location'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Claim', onPress: () => submitClaim(call) },
      ],
    )
  }

  const submitClaim = async (call: OpenCall) => {
    hapticLight()
    setClaimingId(call.id)
    try {
      const result = await claimOpenCall(session.accessToken, call.id)
      // The backend auto-approves when the claimant runs the location, and
      // otherwise parks the claim for a manager. Report which actually happened.
      if (result?.auto_approved) {
        hapticWarning()
        Alert.alert('Call claimed', 'This call is now yours — it has been added to your schedule.')
      } else {
        Alert.alert('Claim sent', 'Your manager still needs to approve this call. You will see it once approved.')
      }
      await load()
    } catch (e: any) {
      hapticWarning()
      Alert.alert('Could not claim', e?.message || 'Please try again.')
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="transparent"
            colors={['transparent']}
            style={{ backgroundColor: 'transparent' }}
          />
        }
      >
        <Pressable onPress={onBack} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={c.primary} />
        </Pressable>
        <Text style={[s.title, { color: c.ink }]}>Open Calls</Text>
        <Text style={[s.subtitle, { color: c.muted }]}>Extra paid shifts available to pick up</Text>

        {error ? (
          <View style={[s.banner, { backgroundColor: c.dangerSurface, borderColor: c.danger + '30' }]}>
            <Ionicons name="alert-circle-outline" size={18} color={c.danger} />
            <Text style={[s.bannerText, { color: c.danger }]}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={s.list}>
            <SkeletonInline c={c} />
            <SkeletonInline c={c} />
            <SkeletonInline c={c} />
          </View>
        ) : calls.length === 0 ? (
          <View style={s.empty}>
            <View style={[s.emptyCircle, { backgroundColor: c.primarySurface }]}>
              <Ionicons name="calendar-outline" size={30} color={c.primary} />
            </View>
            <Text style={[s.emptyTitle, { color: c.ink }]}>No open calls</Text>
            <Text style={[s.emptySub, { color: c.muted }]}>
              New extra shifts will appear here as soon as a manager posts them.
            </Text>
          </View>
        ) : (
          <View style={s.list}>
            {calls.map(call => {
              const interested = call.staff_count || 0
              const busy = claimingId === call.id
              return (
                <View key={call.id} style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }, elevation.sm]}>
                  <View style={s.cardTop}>
                    <View style={s.cardTopText}>
                      <Text style={[s.cardDate, { color: c.ink }]}>{dateLabel(call.start_time)}</Text>
                      <Text style={[s.cardTime, { color: c.primary }]}>
                        {time(call.start_time)}–{time(call.end_time)}
                      </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: c.primarySurface }]}>
                      <Text style={[s.badgeText, { color: c.primary }]}>
                        {SHIFT_TYPE_LABEL[call.shift_type] || call.shift_type}
                      </Text>
                    </View>
                  </View>

                  <View style={s.metaRow}>
                    <Ionicons name="location-outline" size={14} color={c.muted} />
                    <Text style={[s.meta, { color: c.muted }]} numberOfLines={1}>
                      {call.location_name || 'Location'}{call.department_name ? ` · ${call.department_name}` : ''}
                    </Text>
                  </View>

                  <View style={s.metaRow}>
                    <Ionicons name="time-outline" size={14} color={c.muted} />
                    <Text style={[s.meta, { color: c.muted }]}>
                      {durationLabel(call.start_time, call.end_time)}
                    </Text>
                  </View>

                  {interested > 0 ? (
                    <View style={s.metaRow}>
                      <Ionicons name="people-outline" size={14} color={c.muted} />
                      <Text style={[s.meta, { color: c.muted }]}>
                        {interested} {interested === 1 ? 'person has' : 'people have'} already claimed this
                      </Text>
                    </View>
                  ) : null}

                  <PrimaryButton
                    label={busy ? 'Claiming…' : 'Claim this call'}
                    onPress={() => handleClaim(call)}
                    disabled={busy}
                  />
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl, gap: spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', fontFamily: FONT, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: FONT, marginBottom: spacing.xs },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.sm },
  bannerText: { flex: 1, fontSize: 13, fontFamily: FONT },
  list: { gap: spacing.md },
  card: { padding: spacing.base, borderRadius: radii.lg, borderWidth: 1, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTopText: { flex: 1, gap: 2 },
  cardDate: { fontSize: 16, fontWeight: '700', fontFamily: FONT },
  cardTime: { fontSize: 14, fontWeight: '600', fontFamily: FONT },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.sm },
  badgeText: { fontSize: 11, fontWeight: '700', fontFamily: FONT, textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: 13, fontFamily: FONT, flex: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { fontSize: 17, fontWeight: '700', fontFamily: FONT },
  emptySub: { fontSize: 14, fontFamily: FONT, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: 20 },
})
