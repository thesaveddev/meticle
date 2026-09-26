import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { elevation, radii, spacing, FONT, useAppColors, type AppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { PrimaryButton } from '../components/PrimaryButton'
import { SkeletonInline } from '../components/Skeleton'
import { claimOpenCall, getMyOpenCallClaims, getOpenCalls, type MyOpenCallClaim, type OpenCall } from '../services/api'
import { hapticLight, hapticWarning } from '../services/haptics'
import type { AuthSession } from '../types'

interface Props {
  session: AuthSession
  onBack: () => void
}

type Tab = 'available' | 'mine'

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
 * How a claim reads to the person who made it. The three statuses are the ones
 * the backend writes, and the wording matches the web claims page so the same
 * claim is not called something different depending on the device.
 */
function claimStatus(status: string, c: AppColors) {
  if (status === 'assigned') return { label: 'Approved', fg: c.success, bg: c.successSurface, icon: 'checkmark-circle' as const }
  if (status === 'rejected') return { label: 'Rejected', fg: c.danger, bg: c.dangerSurface, icon: 'close-circle' as const }
  if (status === 'pending') return { label: 'Pending', fg: c.warning, bg: c.warningSurface, icon: 'time' as const }
  // Never let an unrecognised status render as a blank badge.
  return { label: status || 'Unknown', fg: c.muted, bg: c.surfaceAlt, icon: 'help-circle' as const }
}

/** Coarse "how long ago", which is all the claims list needs. */
function claimedAgo(value?: string | null) {
  if (!value) return ''
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (!Number.isFinite(minutes)) return ''
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`
}

/**
 * Upcoming work first, then the most recent past work. The API returns
 * everything newest-first, which buries tomorrow's shift under last year's.
 */
function byUrgency(claims: MyOpenCallClaim[]) {
  const start = (claim: MyOpenCallClaim) => new Date(claim.start_time).getTime()
  const now = Date.now()
  const upcoming = claims.filter(claim => new Date(claim.end_time).getTime() >= now).sort((a, b) => start(a) - start(b))
  const past = claims.filter(claim => new Date(claim.end_time).getTime() < now).sort((a, b) => start(b) - start(a))
  return [...upcoming, ...past]
}

/**
 * Open calls: extra shifts a care worker can pick up, and the outcome of the
 * ones they have already claimed.
 *
 * The list comes from `GET /shifts/open`, which returns published, unclaimed
 * shifts for the next fortnight. Claiming posts to `/shifts/:id/claim`, where
 * the backend works out who is claiming from the session, so there is no way to
 * claim on someone else's behalf from the phone.
 *
 * A claim is not always immediate. Unless the claimant manages the location in
 * question — which auto-approves — the claim is held for a manager, and the
 * screen says so rather than implying the extra shift is already the user's.
 * `GET /shifts/my-claims` is what turns that promise into something the worker
 * can check later, so a held claim is never a dead end.
 */
export function OpenCallsScreen({ session, onBack }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [tab, setTab] = useState<Tab>('available')
  const [calls, setCalls] = useState<OpenCall[]>([])
  const [claims, setClaims] = useState<MyOpenCallClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      // Both halves are needed whichever tab is open: a claimed shift stays in
      // the open list until a manager approves it, and only the claims list
      // says whose claim it is.
      const [open, mine] = await Promise.all([
        getOpenCalls(session.accessToken),
        getMyOpenCallClaims(session.accessToken),
      ])
      setCalls(Array.isArray(open) ? open : [])
      setClaims(Array.isArray(mine) ? mine : [])
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Could not load open calls.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session.accessToken])

  useEffect(() => { load() }, [load])

  // A live claim of mine, keyed by shift. Rejected ones drop out so the shift
  // goes back on offer and can be claimed again.
  const myClaimByShift = useMemo(() => {
    const map = new Map<string, MyOpenCallClaim>()
    for (const claim of claims) {
      if (claim.assignment_status !== 'rejected') map.set(claim.shift_id, claim)
    }
    return map
  }, [claims])

  const counts = useMemo(() => ({
    pending: claims.filter(claim => claim.assignment_status === 'pending').length,
    assigned: claims.filter(claim => claim.assignment_status === 'assigned').length,
    rejected: claims.filter(claim => claim.assignment_status === 'rejected').length,
  }), [claims])

  const visibleClaims = useMemo(() => {
    const sorted = byUrgency(claims)
    return statusFilter === 'all' ? sorted : sorted.filter(claim => claim.assignment_status === statusFilter)
  }, [claims, statusFilter])

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

  const renderStatusBadge = (status: string) => {
    const view = claimStatus(status, c)
    return (
      <View style={[s.statusBadge, { backgroundColor: view.bg }]}>
        <Ionicons name={view.icon} size={13} color={view.fg} />
        <Text style={[s.statusText, { color: view.fg }]}>{view.label}</Text>
      </View>
    )
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

        <View style={[s.tabs, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
          {([['available', 'Available'], ['mine', `My claims${claims.length ? ` (${claims.length})` : ''}`]] as [Tab, string][]).map(([key, label]) => {
            const active = tab === key
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[s.tab, active && { backgroundColor: c.surface, borderColor: c.primary }]}
              >
                <Text style={[s.tabText, { color: active ? c.primary : c.muted }]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>

        {error ? (
          <View style={[s.banner, { backgroundColor: c.dangerSurface, borderColor: c.danger + '30' }]}>
            <Ionicons name="alert-circle-outline" size={18} color={c.danger} />
            <Text style={[s.bannerText, { color: c.danger }]}>{error}</Text>
          </View>
        ) : null}

        {tab === 'mine' && !loading && claims.length > 0 ? (
          <View style={s.filters}>
            {([
              ['all', 'All', claims.length],
              ['pending', 'Pending', counts.pending],
              ['assigned', 'Approved', counts.assigned],
              ['rejected', 'Rejected', counts.rejected],
            ] as [string, string, number][])
              .filter(([, , total]) => total > 0 || statusFilter === 'all')
              .map(([key, label, total]) => {
                const active = statusFilter === key
                return (
                  <Pressable
                    key={key}
                    onPress={() => setStatusFilter(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[s.filterChip, { backgroundColor: active ? c.primarySurface : c.surface, borderColor: active ? c.primary : c.border }]}
                  >
                    <Text style={[s.filterText, { color: active ? c.primary : c.muted }]}>{label} ({total})</Text>
                  </Pressable>
                )
              })}
          </View>
        ) : null}

        {loading ? (
          <View style={s.list}>
            <SkeletonInline c={c} />
            <SkeletonInline c={c} />
            <SkeletonInline c={c} />
          </View>
        ) : tab === 'available' ? (
          calls.length === 0 ? (
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
                const mine = myClaimByShift.get(call.id)
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

                    {mine ? (
                      // Already claimed: claiming again would only earn a 409 from
                      // the backend, so say what is happening instead.
                      <View style={s.mineRow}>
                        {renderStatusBadge(mine.assignment_status)}
                        <Text style={[s.mineNote, { color: c.muted }]}>
                          {mine.assignment_status === 'assigned'
                            ? 'This call is yours'
                            : 'Waiting on your manager'}
                        </Text>
                      </View>
                    ) : (
                      <PrimaryButton
                        label={busy ? 'Claiming…' : 'Claim this call'}
                        onPress={() => handleClaim(call)}
                        disabled={busy}
                      />
                    )}
                  </View>
                )
              })}
            </View>
          )
        ) : visibleClaims.length === 0 ? (
          <View style={s.empty}>
            <View style={[s.emptyCircle, { backgroundColor: c.primarySurface }]}>
              <Ionicons name="checkmark-done-outline" size={30} color={c.primary} />
            </View>
            <Text style={[s.emptyTitle, { color: c.ink }]}>
              {claims.length === 0 ? 'No claims yet' : 'Nothing with that status'}
            </Text>
            <Text style={[s.emptySub, { color: c.muted }]}>
              {claims.length === 0
                ? 'Calls you claim will show here, so you can see whether a manager has approved them.'
                : 'Try a different status to see your other claims.'}
            </Text>
          </View>
        ) : (
          <View style={s.list}>
            {visibleClaims.map(claim => (
              <View key={claim.assignment_id} style={[s.card, { backgroundColor: c.surface, borderColor: c.borderLight }, elevation.sm]}>
                <View style={s.cardTop}>
                  <View style={s.cardTopText}>
                    <Text style={[s.cardDate, { color: c.ink }]}>{dateLabel(claim.start_time)}</Text>
                    <Text style={[s.cardTime, { color: c.primary }]}>
                      {time(claim.start_time)}–{time(claim.end_time)}
                    </Text>
                  </View>
                  {renderStatusBadge(claim.assignment_status)}
                </View>

                <View style={s.metaRow}>
                  <Ionicons name="location-outline" size={14} color={c.muted} />
                  <Text style={[s.meta, { color: c.muted }]} numberOfLines={1}>
                    {claim.location_name || 'Location'}
                    {claim.department_name ? ` · ${claim.department_name}` : ''}
                  </Text>
                </View>

                <View style={s.metaRow}>
                  <Ionicons name="time-outline" size={14} color={c.muted} />
                  <Text style={[s.meta, { color: c.muted }]}>
                    {durationLabel(claim.start_time, claim.end_time)}
                    {` · ${SHIFT_TYPE_LABEL[claim.shift_type] || claim.shift_type}`}
                  </Text>
                </View>

                {claim.su_first_name ? (
                  <View style={s.metaRow}>
                    <Ionicons name="person-outline" size={14} color={c.muted} />
                    <Text style={[s.meta, { color: c.muted }]}>
                      {claim.su_first_name} {claim.su_last_name}
                    </Text>
                  </View>
                ) : null}

                <Text style={[s.claimedAt, { color: c.muted }]}>
                  {claim.assignment_status === 'pending'
                    ? 'Waiting on your manager to approve'
                    : claim.assignment_status === 'assigned'
                      ? 'Added to your schedule'
                      : 'Not approved — this call went back on offer'}
                  {claimedAgo(claim.claimed_at) ? ` · Claimed ${claimedAgo(claim.claimed_at)}` : ''}
                </Text>
              </View>
            ))}
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
  tabs: { flexDirection: 'row', gap: spacing.xs, padding: 3, borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '700', fontFamily: FONT },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterChip: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  filterText: { fontSize: 12, fontWeight: '600', fontFamily: FONT },
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
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.sm },
  statusText: { fontSize: 11, fontWeight: '700', fontFamily: FONT },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mineNote: { flex: 1, fontSize: 13, fontFamily: FONT },
  claimedAt: { fontSize: 12, fontFamily: FONT, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: 13, fontFamily: FONT, flex: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { fontSize: 17, fontWeight: '700', fontFamily: FONT },
  emptySub: { fontSize: 14, fontFamily: FONT, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: 20 },
})
