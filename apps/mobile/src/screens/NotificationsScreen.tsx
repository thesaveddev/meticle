import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useTheme } from '../theme'
import type { AuthSession } from '../types'
import { getMyNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '../services/api'
import { hapticLight } from '../services/haptics'
import { Ionicons } from '@expo/vector-icons'

type Notification = {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
}

type Props = {
  session?: AuthSession
  onBack: () => void
}

const TYPE_ICONS: Record<string, { name: string; color: string }> = {
  info: { name: 'information-circle', color: '#3B82F6' },
  warning: { name: 'warning', color: '#F59E0B' },
  success: { name: 'checkmark-circle', color: '#10B981' },
  error: { name: 'alert-circle', color: '#EF4444' },
  default: { name: 'notifications', color: '#6366F1' },
}

export function NotificationsScreen({ session, onBack }: Props) {
  const { colors: c } = useTheme()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const token = session?.accessToken || ''

  const load = useCallback(async () => {
    if (!token) return
    try {
      const data = await getMyNotifications(token)
      setNotifications(data)
    } catch {} finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { if (token) load() }, 30000)
    return () => clearInterval(interval)
  }, [token, load])

  const handleMarkAllRead = async () => {
    hapticLight()
    try {
      await markAllNotificationsRead(token)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {}
  }

  const handleTapNotification = async (notification: Notification) => {
    hapticLight()
    if (!notification.read) {
      try {
        await markNotificationRead(token, notification.id)
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n))
      } catch {}
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

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

    return (
      <TouchableOpacity
        onPress={() => handleTapNotification(item)}
        activeOpacity={0.7}
        style={[styles.card, {
          backgroundColor: item.read ? c.surface : c.primarySurface,
          borderLeftColor: item.read ? c.borderLight : c.primary,
          borderLeftWidth: item.read ? 0 : 3,
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
          <Text style={[styles.cardMessage, { color: c.muted }]} numberOfLines={2}>{item.message}</Text>
          <Text style={[styles.cardTime, { color: c.subtle }]}>{formatTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={c.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: c.ink }]}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={[styles.headerBadge, { backgroundColor: c.primary }]}>{unreadCount}</Text>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
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
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="transparent" />}
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
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-SemiBold' },
  headerBadge: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#FFFFFF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, overflow: 'hidden' },
  markAllBtn: { width: 80, alignItems: 'flex-end' },
  markAllText: { fontSize: 13, fontFamily: 'Inter-Medium' },
  list: { padding: 16, gap: 8 },
  card: {
    flexDirection: 'row', padding: 14, borderRadius: 14, gap: 12, alignItems: 'flex-start',
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1, gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', flex: 1 },
  unread: { fontFamily: 'Inter-Bold' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardMessage: { fontSize: 13, fontFamily: 'Inter-Regular', lineHeight: 18 },
  cardTime: { fontSize: 11, fontFamily: 'Inter-Regular', marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter-Medium' },
  emptyText: { fontSize: 13, fontFamily: 'Inter-Regular' },
})
