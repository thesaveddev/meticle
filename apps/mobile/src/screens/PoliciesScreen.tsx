import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, spacing, radii, FONT } from '../theme'
import type { AuthSession } from '../types'
import {
  acknowledgePolicy,
  getPolicies,
  getPolicyAcknowledgements,
  type PolicySummary,
} from '../services/api'
import { hapticLight } from '../services/haptics'

/**
 * The policy library, and the record of having read it.
 *
 * This is the screen `blueprint §9.7` was missing: the acknowledgements table,
 * the acknowledge endpoint and the per-policy read list already existed, but
 * nothing on the phone reached them, so "had they read the safeguarding policy"
 * could not be answered for anybody who works from the app.
 *
 * It is the compliance officer's own tab (§4.3, §9.8) and is also offered from
 * Settings on every surface, because reading a policy is not a managerial act.
 *
 * Two deliberate shapes:
 *
 *  * **The read state is per policy and belongs to the caller.** The API returns
 *    everyone's rows to a manager and only the caller's own row to anyone else,
 *    so the badge here is always "have *I* read this" — which is the question a
 *    compliance officer opening their own phone is asking.
 *  * **A failed read is not shown as unread.** If the acknowledgement lookup
 *    fails, the policy simply has no badge: a screen that says "not read" when it
 *    could not find out is worse than one that says nothing, because it sends
 *    someone to re-read a policy they had already signed off.
 */
type Props = {
  session: AuthSession
  /** Omitted when the screen *is* the tab, where there is nothing above it to go back to. */
  onBack?: () => void
}

function readOn(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Read'
  return `Read ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

export function PoliciesScreen({ session, onBack }: Props) {
  const { colors: c } = useTheme()
  const [policies, setPolicies] = useState<PolicySummary[]>([])
  const [acknowledged, setAcknowledged] = useState<Record<string, string>>({})
  // Policies whose acknowledgement lookup failed. They are shown without a read
  // state rather than as unread — see the comment at the top of the file.
  const [unresolved, setUnresolved] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<PolicySummary | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const [ackError, setAckError] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError('')
    try {
      const list = await getPolicies(session.accessToken)
      setPolicies(list)
      // One request per policy: the list endpoint does not carry the caller's
      // acknowledgement, and a badge nobody can trust is not worth a server change.
      const results = await Promise.allSettled(
        list.map(policy => getPolicyAcknowledgements(session.accessToken, policy.id))
      )
      const mine: Record<string, string> = {}
      const unknown = new Set<string>()
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') { unknown.add(list[index].id); return }
        const own = result.value.find(row => row.user_id === session.user.id)
        if (own) mine[list[index].id] = own.acknowledged_at
      })
      setAcknowledged(mine)
      setUnresolved(unknown)
    } catch (caught: any) {
      // The list is the page; without it there is nothing honest to show.
      setError(caught?.message || 'Could not load the policies.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session])

  useEffect(() => { load() }, [load])

  const sections = useMemo(() => {
    const byCategory = new Map<string, PolicySummary[]>()
    for (const policy of policies) {
      const key = policy.category || 'Policies'
      const rows = byCategory.get(key) || []
      rows.push(policy)
      byCategory.set(key, rows)
    }
    return [...byCategory.entries()].map(([title, data]) => ({ title, data }))
  }, [policies])

  const acknowledge = async (policy: PolicySummary) => {
    hapticLight()
    setAcknowledging(true)
    setAckError('')
    try {
      const row = await acknowledgePolicy(session.accessToken, policy.id)
      setAcknowledged(previous => ({ ...previous, [policy.id]: row.acknowledged_at }))
    } catch (caught: any) {
      setAckError(caught?.message || 'Could not record that you have read this policy.')
    } finally {
      setAcknowledging(false)
    }
  }

  if (open) {
    const ackAt = acknowledged[open.id]
    const paragraphs = open.content.split('\n').map(line => line.trim()).filter(Boolean)
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to policies"
            onPress={() => { hapticLight(); setOpen(null); setAckError('') }}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={24} color={c.ink} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.ink }]} numberOfLines={1}>Policies</Text>
        </View>
        <SectionList
          sections={[{ title: open.category, data: paragraphs }]}
          keyExtractor={(line, index) => `${index}-${line.slice(0, 24)}`}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View>
              <Text style={[styles.detailTitle, { color: c.ink }]}>{open.title}</Text>
              <Text style={[styles.detailMeta, { color: c.muted }]}>
                {open.category} · Version {open.version}
                {open.review_due_at ? ` · Review due ${new Date(open.review_due_at).toLocaleDateString('en-GB')}` : ''}
              </Text>
              {ackAt ? (
                <Text style={[styles.detailRead, { color: c.success }]}>{readOn(ackAt)}</Text>
              ) : null}
              <View style={[styles.rule, { backgroundColor: c.borderLight }]} />
            </View>
          }
          renderItem={({ item }) => (
            <Text style={[styles.paragraph, { color: c.ink }]}>{item}</Text>
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              {ackError ? <Text style={[styles.errorText, { color: c.danger }]}>{ackError}</Text> : null}
              {ackAt ? (
                <Text style={[styles.footerNote, { color: c.muted }]}>
                  Your read is recorded against your account. Opening it again updates the date rather than
                  adding a second record.
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="I have read this policy"
                  disabled={acknowledging}
                  onPress={() => acknowledge(open)}
                  style={({ pressed }) => [
                    styles.ackButton,
                    { backgroundColor: c.primary, opacity: pressed || acknowledging ? 0.7 : 1 },
                  ]}
                >
                  {acknowledging
                    ? <ActivityIndicator color={c.inverse} />
                    : <Text style={[styles.ackButtonText, { color: c.inverse }]}>I have read this policy</Text>}
                </Pressable>
              )}
            </View>
          }
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => { hapticLight(); onBack() }}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={24} color={c.ink} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Text style={[styles.headerTitle, { color: c.ink }]}>Policies</Text>
      </View>

      {loading ? (
        <View style={styles.centre}><ActivityIndicator color={c.primary} /></View>
      ) : error ? (
        <View style={styles.centre}>
          <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => { setLoading(true); load() }}
            style={[styles.retry, { borderColor: c.border }]}
          >
            <Text style={[styles.retryText, { color: c.primary }]}>Try again</Text>
          </Pressable>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centre}>
          <Text style={[styles.emptyTitle, { color: c.ink }]}>No policies yet</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>
            Your organisation has not published any policies. They will appear here when it does.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={policy => policy.id}
          contentContainerStyle={styles.content}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c.primary} />
          }
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionLabel, { color: c.subtle }]}>{section.title.toUpperCase()}</Text>
          )}
          renderItem={({ item }) => {
            const ackAt = acknowledged[item.id]
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => { hapticLight(); setOpen(item); setAckError('') }}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: c.surface, borderColor: c.borderLight },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: c.ink }]}>{item.title}</Text>
                  <Text style={[styles.rowMeta, { color: ackAt ? c.primary : c.muted }]}>
                    Version {item.version}
                    {ackAt ? ` · ${readOn(ackAt)}` : unresolved.has(item.id) ? '' : ' · Not yet read'}
                  </Text>
                </View>
                {ackAt ? (
                  <Ionicons name="checkmark-circle" size={20} color={c.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={20} color={c.subtle} />
                )}
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: spacing.xs },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  sectionLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: spacing.md, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.xs,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  rowMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  detailTitle: { fontFamily: FONT, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: spacing.sm },
  detailMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '500', marginTop: 4 },
  detailRead: { fontFamily: FONT, fontSize: 12, fontWeight: '700', marginTop: spacing.xs },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.md },
  paragraph: { fontFamily: FONT, fontSize: 14, lineHeight: 21, marginBottom: spacing.sm },
  footer: { marginTop: spacing.lg, gap: spacing.sm },
  footerNote: { fontFamily: FONT, fontSize: 12, lineHeight: 18 },
  ackButton: { borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center' },
  ackButtonText: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '700' },
  emptyBody: { fontFamily: FONT, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  errorText: { fontFamily: FONT, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  retryText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
})
