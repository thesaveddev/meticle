import { useCallback, useEffect, useState } from 'react'
import { ActionSheetIOS, Alert, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'

import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession, MobileUser } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { hapticLight } from '../services/haptics'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://meticlecare.com/api'

interface Props {
  session: AuthSession
  user: MobileUser
  onBack: () => void
  onSaved: () => void
}

export function ProfileScreen({ session, user, onBack, onSaved }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [firstName, setFirstName] = useState(user.first_name || '')
  const [lastName, setLastName] = useState(user.last_name || '')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadProfile = useCallback(() => {
    return fetch(`${API_BASE}/staff/me/profile`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        if (data.first_name) setFirstName(data.first_name)
        if (data.last_name) setLastName(data.last_name)
        if (data.phone) setPhone(data.phone)
        if (data.address) setAddress(data.address)
        if (data.city) setCity(data.city)
        if (data.postal_code) setPostalCode(data.postal_code)
        if (data.profile_picture_url) setProfilePhoto(data.profile_picture_url)
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [session.accessToken])

  useEffect(() => { loadProfile() }, [loadProfile])

  const pickFromGallery = async () => {
    hapticLight()
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to upload a profile picture.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setLocalPhotoUri(result.assets[0].uri)
      await uploadPhoto(result.assets[0].uri)
    }
  }

  const takeWithCamera = async () => {
    hapticLight()
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access to take a profile photo.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setLocalPhotoUri(result.assets[0].uri)
      await uploadPhoto(result.assets[0].uri)
    }
  }

  const showPhotoOptions = () => {
    hapticLight()
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) takeWithCamera()
          else if (buttonIndex === 2) pickFromGallery()
        }
      )
    } else {
      Alert.alert('Change Photo', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takeWithCamera },
        { text: 'Choose from Library', onPress: pickFromGallery },
      ])
    }
  }

  const uploadPhoto = async (uri: string) => {
    setUploadingPhoto(true)
    try {
      const filename = uri.split('/').pop() || 'photo.jpg'
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`

      const formData = new FormData()
      formData.append('file', {
        uri,
        name: filename,
        type: mimeType,
      } as any)

      const res = await fetch(`${API_BASE}/staff/me/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Upload failed')
      }
      const data = await res.json()
      setProfilePhoto(data.url)
      setMessage('Photo updated')
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Required', 'First name is required')
      return
    }
    setSaving(true); setMessage('')
    try {
      const res = await fetch(`${API_BASE}/staff/me/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          postal_code: postalCode.trim() || null,
          profile_picture_url: profilePhoto || undefined,
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
  const displayPhoto = localPhotoUri || profilePhoto

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfile() }} tintColor="transparent" />}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={c.primary} />
          <Text style={[s.backText, { color: c.primary }]}>Settings</Text>
        </Pressable>
        <Text style={[s.title, { color: c.ink }]}>My Profile</Text>

        {/* Avatar with photo upload */}
        <View style={s.avatarSection}>
          <Pressable onPress={showPhotoOptions} style={s.avatarWrap}>
            {displayPhoto ? (
              <Image source={{ uri: displayPhoto } as any} style={s.avatarImage} />
            ) : (
              <View style={[s.avatar, { backgroundColor: c.primarySurface, borderColor: c.primary + '30' }]}>
                <Text style={[s.avatarText, { color: c.primary }]}>{initials}</Text>
              </View>
            )}
            <View style={[s.cameraBadge, { backgroundColor: c.primary }]}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
            {uploadingPhoto && <View style={s.uploadOverlay}><Text style={[s.uploadText, { color: '#FFFFFF' }]}>Uploading...</Text></View>}
          </Pressable>
          <Pressable onPress={showPhotoOptions} style={[s.photoBtn, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Ionicons name="camera-outline" size={16} color={c.primary} />
            <Text style={[s.photoBtnText, { color: c.primary }]}>Change photo</Text>
          </Pressable>
        </View>

        {/* Form */}
        <View style={[s.formCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          <View style={s.fieldRow}>
            <View style={s.fieldHalf}>
              <Text style={[s.fieldLabel, { color: c.inkLight }]}>First name *</Text>
              <TextInput value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.subtle} style={[s.input, { backgroundColor: c.surfaceAlt, color: c.ink, borderColor: c.border }]} />
            </View>
            <View style={s.fieldHalf}>
              <Text style={[s.fieldLabel, { color: c.inkLight }]}>Last name</Text>
              <TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={colors.subtle} style={[s.input, { backgroundColor: c.surfaceAlt, color: c.ink, borderColor: c.border }]} />
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: c.inkLight }]}>Email</Text>
            <TextInput value={user.email} editable={false} style={[s.input, { backgroundColor: c.bg, color: c.muted, borderColor: c.border }]} />
          </View>

          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: c.inkLight }]}>Phone</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="Your phone number" placeholderTextColor={colors.subtle} keyboardType="phone-pad" style={[s.input, { backgroundColor: c.surfaceAlt, color: c.ink, borderColor: c.border }]} />
          </View>

          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: c.inkLight }]}>Address</Text>
            <TextInput value={address} onChangeText={setAddress} placeholder="Street address" placeholderTextColor={colors.subtle} style={[s.input, { backgroundColor: c.surfaceAlt, color: c.ink, borderColor: c.border }]} />
          </View>

          <View style={s.fieldRow}>
            <View style={s.fieldHalf}>
              <Text style={[s.fieldLabel, { color: c.inkLight }]}>City</Text>
              <TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={colors.subtle} style={[s.input, { backgroundColor: c.surfaceAlt, color: c.ink, borderColor: c.border }]} />
            </View>
            <View style={s.fieldHalf}>
              <Text style={[s.fieldLabel, { color: c.inkLight }]}>Postcode</Text>
              <TextInput value={postalCode} onChangeText={setPostalCode} placeholder="Postcode" placeholderTextColor={colors.subtle} style={[s.input, { backgroundColor: c.surfaceAlt, color: c.ink, borderColor: c.border }]} />
            </View>
          </View>
        </View>

        {message ? (
          <View style={[s.successBanner, { backgroundColor: c.successSurface }]}>
            <Ionicons name="checkmark-circle" size={20} color={c.success} />
            <Text style={[s.successText, { color: c.successDeep }]}>{message}</Text>
          </View>
        ) : null}

        <PrimaryButton label="Save profile" onPress={handleSave} loading={saving} disabled={saving} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backText: { fontFamily: FONT, fontSize: 15, fontWeight: '500' },
  title: { fontFamily: FONT, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginBottom: spacing.base },

  /* Avatar */
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.sm },
  avatarWrap: { position: 'relative', width: 96, height: 96 },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', ...elevation.sm,
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.primary + '30' },
  avatarText: { fontFamily: FONT, fontSize: 36, fontWeight: '700' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface, ...elevation.sm,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFill, borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  uploadText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1 },
  photoBtnText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },

  /* Form */
  formCard: {
    borderRadius: radii.lg, borderWidth: 1,
    padding: spacing.base, gap: spacing.base, marginBottom: spacing.base,
    ...elevation.sm,
  },
  fieldRow: { flexDirection: 'row', gap: spacing.base },
  fieldHalf: { flex: 1 },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1.5, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontFamily: FONT, fontSize: 15,
  },

  /* Messages */
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.base,
  },
  successText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', flex: 1 },
})
