import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { AuthSession, MobileUser } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'

interface Props {
  session: AuthSession
  user: MobileUser
  onBack: () => void
  onSaved: () => void
}

export function ProfileScreen({ session, user, onBack, onSaved }: Props) {
  const [firstName, setFirstName] = useState(user.first_name || '')
  const [lastName, setLastName] = useState(user.last_name || '')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load current profile data
    fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'https://meticlecare.com/api'}/staff/me/profile`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.first_name) setFirstName(data.first_name)
        if (data.last_name) setLastName(data.last_name)
        if (data.phone) setPhone(data.phone)
        if (data.address) setAddress(data.address)
        if (data.city) setCity(data.city)
        if (data.postal_code) setPostalCode(data.postal_code)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Required', 'First name is required')
      return
    }
    setSaving(true); setMessage('')
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://meticlecare.com/api'
      const res = await fetch(`${API_BASE}/staff/${user.id}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          postal_code: postalCode.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Could not save')
      }
      setMessage('Profile saved')
      setTimeout(() => onSaved(), 1200)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const initials = (firstName[0] || user.email[0]).toUpperCase()

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Settings</Text>
        </Pressable>
        <Text style={styles.title}>My Profile</Text>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.avatarHint}>Profile photo</Text>
          <Text style={styles.avatarNote}>Contact your manager to update your photo</Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>First name *</Text>
              <TextInput value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.subtle} style={styles.input} />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Last name</Text>
              <TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={colors.subtle} style={styles.input} />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput value={user.email} editable={false} style={[styles.input, styles.inputDisabled]} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="Your phone number" placeholderTextColor={colors.subtle} keyboardType="phone-pad" style={styles.input} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput value={address} onChangeText={setAddress} placeholder="Street address" placeholderTextColor={colors.subtle} style={styles.input} />
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={colors.subtle} style={styles.input} />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Postcode</Text>
              <TextInput value={postalCode} onChangeText={setPostalCode} placeholder="Postcode" placeholderTextColor={colors.subtle} style={styles.input} />
            </View>
          </View>
        </View>

        {message ? (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>{message}</Text>
          </View>
        ) : null}

        <PrimaryButton label="Save profile" onPress={handleSave} loading={saving} disabled={saving} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: 'System', fontSize: 15, fontWeight: '500', color: colors.primary },
  title: { ...type.title, marginBottom: spacing.base },

  /* Avatar */
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primarySurface, borderWidth: 3, borderColor: colors.primary + '30',
    alignItems: 'center', justifyContent: 'center', ...elevation.sm,
  },
  avatarText: { fontFamily: 'System', fontSize: 32, fontWeight: '700', color: colors.primary },
  avatarHint: { ...type.bodyBold, marginTop: spacing.sm },
  avatarNote: { ...type.small, marginTop: 2 },

  /* Form */
  formCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1,
    borderColor: colors.borderLight, padding: spacing.base, gap: spacing.base, marginBottom: spacing.base,
    ...elevation.sm,
  },
  fieldRow: { flexDirection: 'row', gap: spacing.base },
  fieldHalf: { flex: 1 },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.inkLight },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.ink, fontFamily: 'System', fontSize: 15,
  },
  inputDisabled: { backgroundColor: colors.bg, color: colors.muted },

  /* Messages */
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.successSurface, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.base,
  },
  successIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, color: colors.inverse, textAlign: 'center', lineHeight: 22, fontSize: 13, fontWeight: '700' },
  successText: { ...type.small, color: colors.successDeep, flex: 1 },
})
