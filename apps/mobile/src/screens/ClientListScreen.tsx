import { useEffect, useState, useCallback } from 'react'
import { RefreshControl, FlatList, StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession } from '../types'
import { getClientList } from '../services/api'
import { hapticLight } from '../services/haptics'

interface Props {
  session: AuthSession
  onBack?: () => void
  onSelect?: (personId: string) => void
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#DCFCE7', text: '#166534' },
  discharged: { bg: '#F3F4F6', text: '#6B7280' },
  deceased: { bg: '#FEE2E2', text: '#991B1B' },
}

function getAvatarColor(name: string) {
  const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function ClientListScreen({ session, onBack, onSelect }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const data = await getClientList(session.accessToken)
      setClients(data)
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter((p: any) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase()
    return name.includes(q) || (p.nhs_number || '').includes(q)
  })

  const activeCount = clients.filter((p: any) => p.status === 'active').length

  const renderItem = ({ item }: { item: any }) => {
    const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown'
    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.active
    const color = getAvatarColor(name)

    return (
      <Pressable
        onPress={() => { hapticLight(); onSelect?.(item.id) }}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', padding: spacing.base, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.borderLight }, pressed && { backgroundColor: c.surfaceAlt }]}
      >
        <View style={[s.avatar, { backgroundColor: color }]}>
          <Text style={s.avatarText}>{name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: c.ink }]} numberOfLines={1}>{name}</Text>
          <Text style={[s.meta, { color: c.muted }]} numberOfLines={1}>
            {item.nhs_number ? `NHS ${item.nhs_number}` : item.date_of_birth ? `DOB ${item.date_of_birth}` : 'No NHS number'}
          </Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[s.statusText, { color: sc.text }]}>{item.status || 'Active'}</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={[s.screen, dyn(c).screen]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Pressable onPress={onBack} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: c.ink }]}>Clients</Text>
          <Text style={[s.headerSub, { color: c.muted }]}>{activeCount} active of {clients.length}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput
          style={[s.searchInput, { color: c.ink }]}
          placeholder="Search by name or NHS number..."
          placeholderTextColor={c.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={c.muted} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="small" color={c.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="transparent" />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="people-outline" size={48} color={c.border} />
              <Text style={[s.emptyTitle, { color: c.ink }]}>No clients found</Text>
              <Text style={[s.emptySub, { color: c.muted }]}>{search ? 'Try a different search' : 'Clients will appear here'}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...type.title, fontSize: 17 },
  headerSub: { fontFamily: FONT, fontSize: 12, marginTop: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.base,
    marginTop: spacing.sm, marginBottom: spacing.xs, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: FONT, fontSize: 15 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: FONT },
  name: { fontSize: 15, fontWeight: '600', fontFamily: FONT },
  meta: { fontSize: 12, fontFamily: FONT, marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '600', fontFamily: FONT },
  emptySub: { fontSize: 14, fontFamily: FONT },
})
