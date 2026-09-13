import { useEffect, useState, useCallback } from 'react'
import { RefreshControl, FlatList, StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession } from '../types'
import { getStaffDirectory } from '../services/api'
import { hapticLight } from '../services/haptics'

interface Props {
  session: AuthSession
  onBack?: () => void
  onSelect?: (userId: string) => void
}

const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'Admin',
  MANAGER: 'Manager',
  CARE_WORKER: 'Carer',
  COMPLIANCE_OFFICER: 'Compliance',
}

const ROLE_COLORS: Record<string, string> = {
  ORG_ADMIN: '#6366F1',
  MANAGER: '#8B5CF6',
  CARE_WORKER: '#10B981',
  COMPLIANCE_OFFICER: '#F59E0B',
}

function complianceDot(rate: number) {
  if (rate >= 80) return '#10B981'
  if (rate >= 50) return '#F59E0B'
  return '#EF4444'
}

function getAvatarColor(name: string) {
  const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function StaffDirectoryScreen({ session, onBack, onSelect }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const data = await getStaffDirectory(session.accessToken)
      setMembers(data)
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken])

  useEffect(() => { load() }, [load])

  const filtered = members.filter((m: any) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const name = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase()
    return name.includes(q) || m.email.toLowerCase().includes(q)
  })

  const activeCount = members.filter((m: any) => m.status === 'active').length

  const renderItem = ({ item }: { item: any }) => {
    const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.email
    const roleLabel = ROLE_LABELS[item.role] || item.role
    const roleColor = ROLE_COLORS[item.role] || '#6B7280'
    const compliance = item.compliance_rate || 0
    const color = getAvatarColor(name)
    const isActive = item.status === 'active'

    return (
      <Pressable
        onPress={() => { hapticLight(); onSelect?.(item.id) }}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', padding: spacing.base, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.borderLight, opacity: isActive ? 1 : 0.5 }, pressed && { backgroundColor: c.surfaceAlt }]}
      >
        <View style={[s.avatar, { backgroundColor: color }]}>
          <Text style={s.avatarText}>{name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</Text>
          {/* Compliance dot */}
          <View style={[s.complianceDot, { backgroundColor: complianceDot(compliance) }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: c.ink }]} numberOfLines={1}>{name}</Text>
          <View style={s.metaRow}>
            <View style={[s.roleBadge, { backgroundColor: roleColor + '18' }]}>
              <Text style={[s.roleText, { color: roleColor }]}>{roleLabel}</Text>
            </View>
            {!isActive && (
              <View style={[s.roleBadge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[s.roleText, { color: '#991B1B' }]}>{item.status}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={s.complianceWrap}>
          <Text style={[s.complianceRate, { color: complianceDot(compliance) }]}>{compliance}%</Text>
          <Text style={[s.complianceLabel, { color: c.muted }]}>compliance</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={[s.screen, dyn(c).screen]} edges={['top']}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Pressable onPress={onBack} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: c.ink }]}>Staff</Text>
          <Text style={[s.headerSub, { color: c.muted }]}>{activeCount} active of {members.length}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={[s.searchWrap, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput
          style={[s.searchInput, { color: c.ink }]}
          placeholder="Search by name or email..."
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
              <Text style={[s.emptyTitle, { color: c.ink }]}>No staff found</Text>
              <Text style={[s.emptySub, { color: c.muted }]}>{search ? 'Try a different search' : 'Staff members will appear here'}</Text>
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
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontFamily: FONT },
  complianceDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF' },
  name: { fontSize: 15, fontWeight: '600', fontFamily: FONT },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  roleText: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },
  complianceWrap: { alignItems: 'center' },
  complianceRate: { fontFamily: 'System', fontSize: 14, fontWeight: '700' },
  complianceLabel: { fontFamily: FONT, fontSize: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '600', fontFamily: FONT },
  emptySub: { fontSize: 14, fontFamily: FONT },
})
