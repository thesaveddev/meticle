import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, SectionList, TouchableOpacity, RefreshControl, AppState } from 'react-native'
import { useTheme, spacing, FONT, CHART_PALETTE } from '../theme'
import type { AuthSession } from '../types'
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api'
import { hapticLight } from '../services/haptics'
import { notificationAction, notificationTarget } from '../utils/notificationLinks'
import { Ionicons } from '@expo/vector-icons'

/**
 * The supported-living carer's notifications inbox.
 *
 * Every event the service raises about supported living arrives here: a shift that
 * ended with no handover written, a room nobody checked today, a medication round
 * missed, training or a DBS certificate about to expire, an incident raised. The
 * server composes one relative record path per notification (`micaRecordPath` in
 * `@meticle/shared`), and each row says where that path goes before it is tapped.
 *
 * Three things make it usable on a phone, and each of them is a way the previous list
 * fell short:
 *
 *  * **Unread first, then history.** A carer opening this screen is asking "what do I
 *    owe somebody?", so the unread events are their own section rather than mixed into
 *    a reverse-chronological list where last night's handover nudge sits between
 *    yesterday's read items.
 *  * **A tap goes somewhere.** A record the phone has a screen for opens it (the week
 *    view for a shift and its handover, the chat tab for a message). A record it does
 *    not — room checks, the MAR chart, compliance — expands the row so the full
 *    message and where the record lives are both visible. Nothing is a tap that does
 *    nothing.
 *  * **It is current on arrival.** The list loads on mount, so a cold start shows what
 *    is waiting rather than an empty screen, and it reloads when the app comes back to
 *    the foreground, which is the moment a carer returns to a phone that was in their
 *    pocket while the rota moved.
 *  * **The history is reachable.** The server returns a page, not the whole inbox, so
 *    the list asks for the next one as the carer reaches the bottom (and offers the
 *    button where the reach is awkward). A carer back after a week gets to the
 *    handover nudge from the Monday, which used to be the row that fell off the end of
 *    a fixed twenty. Reloading keeps what has already been fetched, so a poll does not
 *    yank the history away while it is being read.
 */
type Notification = {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
  /** The record this notification is about, when it is about one. */
  link?: string | null
}

type Props = {
  session?: AuthSession
  onBack: () => void
  /**
   * Where to go when a row's record has a screen in this app. Supplied by `App`,
   * which owns the screen stack and knows which tabs this role has; the screen itself
   * has no navigation.
   */
  onOpenLink?: (link: string) => void
  /**
   * The unread count this screen can see, reported to `App` so the bell's badge
   * falls the moment a row is read instead of waiting for the next poll. The
   * server remains the source of truth: this is the same number it just returned.
   */
  onUnreadChange?: (count: number) => void
}

/**
 * One icon per notification family the API actually raises.
 *
 * The server's types are the preference keys (`notifications.controller.ts`), so this
 * is the list of things a provider can be told about: a compliance obligation, a
 * training expiry, a shift or handover, medication, an incident, leave. Anything
 * unrecognised falls back to the bell rather than to no icon at all.
 */
const TYPE_ICONS: Record<string, { name: string; color: string }> = {
  compliance: { name: 'shield-checkmark', color: '#0164C8' },
  // Colours come from the shared chart palette, which the palette guard holds to the
  // master order — a one-off hex here is how a legacy blue reappears on a brand screen.
  training: { name: 'school', color: CHART_PALETTE[5] },
  documents: { name: 'document-text', color: CHART_PALETTE[6] },
  medication: { name: 'medkit', color: '#EF4444' },
  incident: { name: 'warning', color: '#EF4444' },
  shift: { name: 'calendar', color: '#0164C8' },
  swap: { name: 'swap-horizontal', color: '#F59E0B' },
  overtime: { name: 'time', color: '#10B981' },
  leave: { name: 'airplane', color: CHART_PALETTE[6] },
  delegation: { name: 'people', color: CHART_PALETTE[5] },
  survey: { name: 'star', color: '#F59E0B' },
  general: { name: 'notifications', color: '#0164C8' },
  info: { name: 'information-circle', color: '#0164C8' },
  warning: { name: 'warning', color: '#F59E0B' },
  success: { name: 'checkmark-circle', color: '#10B981' },
  error: { name: 'alert-circle', color: '#EF4444' },
  default: { name: 'notifications', color: '#0164C8' },
}

/** How many rows one request asks for — the same page the inbox has always shown. */
const PAGE_SIZE = 20

const byNewest = (a: Notification, b: Notification) => {
  const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  return diff !== 0 ? diff : a.id.localeCompare(b.id)
}

/**
 * A page laid over what is already held.
 *
 * The server's copy of a row wins — it is where `read` was last settled — and rows
 * already fetched survive a refresh, because the alternative is losing the history the
 * carer just scrolled to every time the 30-second poll comes round.
 */
export function mergeNotifications(held: Notification[], incoming: Notification[]): Notification[] {
  const byId = new Map(held.map(n => [n.id, n] as const))
  for (const n of incoming) byId.set(n.id, { ...byId.get(n.id), ...n })
  return Array.from(byId.values()).sort(byNewest)
}

export function NotificationsScreen({ session, onBack, onOpenLink, onUnreadChange }: Props) {
  const { colors: c } = useTheme()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const token = session?.accessToken || ''
  // What the screen holds, readable from an async callback without making every
  // loader depend on the list itself (which would rebuild it on each page).
  const held = useRef<Notification[]>([])

  /**
   * The one way state changes: the list, the ref the loaders read, and the badge the
   * tab shows all come from the same array, so the number beside the bell is always
   * the count of what is on screen.
   */
  const commit = useCallback((next: Notification[]) => {
    held.current = next
    setNotifications(next)
    onUnreadChange?.(next.filter(n => !n.read).length)
  }, [onUnreadChange])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const data = await getMyNotifications(token, { limit: PAGE_SIZE })
      const page: Notification[] = Array.isArray(data) ? data : []
      // A short first page on an empty screen is the whole inbox; anything else and
      // only the next page can say whether there is more.
      if (held.current.length === 0) setHasMore(page.length === PAGE_SIZE)
      commit(mergeNotifications(held.current, page))
    } catch {} finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, commit])

  /**
   * The page below the oldest row held.
   *
   * The cursor is that row's own `(created_at, id)` — keyset, so a notification that
   * arrives mid-scroll cannot shift the page boundary and hide a row, which is exactly
   * how a fixed-`LIMIT` inbox loses one.
   */
  const loadOlder = useCallback(async () => {
    if (!token || loadingOlder || !hasMore) return
    const oldest = [...held.current].sort(byNewest).pop()
    if (!oldest) return
    setLoadingOlder(true)
    try {
      const data = await getMyNotifications(token, {
        limit: PAGE_SIZE,
        before: oldest.created_at,
        beforeId: oldest.id,
      })
      const page: Notification[] = Array.isArray(data) ? data : []
      setHasMore(page.length === PAGE_SIZE)
      if (page.length > 0) commit(mergeNotifications(held.current, page))
    } catch {} finally {
      setLoadingOlder(false)
    }
  }, [token, loadingOlder, hasMore, commit])

  // Mount, which is what makes a cold start show the events that are waiting rather
  // than an empty list until the poll comes round.
  useEffect(() => { load() }, [load])

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { if (token) load() }, 30000)
    return () => clearInterval(interval)
  }, [token, load])

  // And refresh when the app returns to the foreground: a phone in a pocket is not
  // polling, and the carer should not have to pull to find out what changed.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') load()
    })
    return () => subscription.remove()
  }, [load])

  const handleMarkAllRead = async () => {
    hapticLight()
    try {
      await markAllNotificationsRead(token)
      commit(held.current.map(n => ({ ...n, read: true })))
    } catch {}
  }

  const handleTapNotification = async (notification: Notification) => {
    hapticLight()
    if (!notification.read) {
      try {
        await markNotificationRead(token, notification.id)
        // Counted from the list this tap just changed, so the badge matches the
        // screen the carer is looking at rather than the count from before the tap.
        commit(held.current.map(n => n.id === notification.id ? { ...n, read: true } : n))
      } catch {}
    }

    const link = notification.link
    // Anything this app has a destination for is opened: a tab, or one shift's
    // handover. Only a record the phone cannot show falls through to the row
    // expanding in place.
    if (link && notificationTarget(link).kind !== 'notifications') {
      onOpenLink?.(link)
      return
    }
    // The phone has no screen for this record: the row expands instead, so the whole
    // message and the page it lives on are both readable.
    setExpandedId(prev => (prev === notification.id ? null : notification.id))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const sections = useMemo(() => {
    const unread = notifications.filter(n => !n.read)
    const earlier = notifications.filter(n => n.read)
    return [
      ...(unread.length > 0 ? [{ title: 'Needs attention', data: unread }] : []),
      ...(earlier.length > 0 ? [{ title: 'Earlier', data: earlier }] : []),
    ]
  }, [notifications])

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconInfo = TYPE_ICONS[item.type] || TYPE_ICONS.default
    const action = notificationAction(item.link)
    const expanded = expandedId === item.id

    return (
      <TouchableOpacity
        onPress={() => handleTapNotification(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.read ? '' : 'Unread: '}${item.title}. ${item.message}`}
        style={[styles.card, {
          backgroundColor: item.read ? c.surface : c.primarySurface,
        }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconInfo.color + '15' }]}>
          <Ionicons name={iconInfo.name as any} size={20} color={iconInfo.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: c.ink }, !item.read && styles.unread]} numberOfLines={1}>{item.title}</Text>
            {!item.read && <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />}
          </View>
          <Text style={[styles.cardMessage, { color: c.muted }]} numberOfLines={expanded ? undefined : 2}>{item.message}</Text>
          <Text style={[styles.cardTime, { color: c.subtle }]}>{formatTime(item.created_at)}</Text>
          {action.label ? (
            <Text style={[styles.cardAction, { color: action.native ? c.primary : c.subtle }]}>
              {action.native ? `Opens ${action.label}` : `Recorded on the web — ${action.label}`}
            </Text>
          ) : null}
        </View>
        {action.native ? (
          <Ionicons name="chevron-forward" size={18} color={c.subtle} style={styles.cardChevron} />
        ) : null}
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={c.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: c.ink }]}>Notifications</Text>
          {unreadCount > 0 && (
            <Text testID="notification-unread-count" style={[styles.headerBadge, { backgroundColor: c.primary }]}>{unreadCount}</Text>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn} accessibilityRole="button">
            <Text style={[styles.markAllText, { color: c.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* Notifications list */}
      {loading ? (
        <View style={styles.centered}>
          <Text style={{ color: c.muted }}>Loading notifications...</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: c.subtle }]}>{section.title}</Text>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="transparent" />}
          ListFooterComponent={
            notifications.length === 0 ? null : hasMore ? (
              <TouchableOpacity
                onPress={loadOlder}
                disabled={loadingOlder}
                style={styles.loadOlder}
                accessibilityRole="button"
                accessibilityLabel="Load older notifications"
                testID="notifications-load-older"
              >
                <Text style={[styles.loadOlderText, { color: loadingOlder ? c.subtle : c.primary }]}>
                  {loadingOlder ? 'Loading older notifications...' : 'Load older notifications'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text testID="notifications-end" style={[styles.loadOlderText, styles.endOfList, { color: c.subtle }]}>
                That's every notification in your inbox.
              </Text>
            )
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="notifications-off-outline" size={48} color={c.borderLight} />
              <Text style={[styles.emptyTitle, { color: c.ink }]}>No notifications</Text>
              <Text style={[styles.emptyText, { color: c.muted }]}>You're all caught up</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', fontFamily: FONT, letterSpacing: -0.3 },
  headerBadge: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, overflow: 'hidden' },
  markAllBtn: { width: 80, alignItems: 'flex-end' },
  markAllText: { fontSize: 13, fontFamily: 'Inter-Medium' },
  list: { padding: 16, gap: 8 },
  loadOlder: { paddingVertical: 16, alignItems: 'center' },
  loadOlderText: { fontSize: 13, fontFamily: 'Inter-Medium' },
  endOfList: { paddingVertical: 16, textAlign: 'center' },
  sectionHeader: { fontSize: 11, fontFamily: 'Inter-SemiBold', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 8, marginBottom: 2 },
  card: {
    flexDirection: 'row', padding: 14, borderRadius: 14, gap: 12, alignItems: 'flex-start',
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1, gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', flex: 1 },
  cardChevron: { alignSelf: 'center' },
  unread: { fontFamily: 'Inter-Bold' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardMessage: { fontSize: 13, fontFamily: 'Inter-Regular', lineHeight: 18 },
  cardTime: { fontSize: 11, fontFamily: 'Inter-Regular', marginTop: 2 },
  cardAction: { fontSize: 11, fontFamily: 'Inter-Medium', marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter-Medium' },
  emptyText: { fontSize: 13, fontFamily: 'Inter-Regular' },
})
