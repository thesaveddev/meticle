import { Platform, Alert, Linking } from 'react-native'

/**
 * Open the best available maps app with directions to the destination.
 * - iOS: opens Apple Maps by default
 * - Android: opens Google Maps by default
 * - Falls back to Waze, then browser
 */
export async function openNavigation(options: {
  destination?: string
  latitude?: number
  longitude?: number
  label?: string
}) {
  const { destination, latitude, longitude, label } = options

  // Build the destination string
  let dest = ''
  if (latitude != null && longitude != null) {
    dest = `${latitude},${longitude}`
  } else if (destination) {
    dest = encodeURIComponent(destination)
  } else {
    Alert.alert('No address', 'No destination address available for this visit.')
    return
  }

  const name = label || 'Client location'

  if (Platform.OS === 'ios') {
    // Try Apple Maps first (native, always available)
    const appleUrl = latitude != null
      ? `maps://?daddr=${dest}&dirflg=d`
      : `maps://?q=${dest}`

    const canOpen = await Linking.canOpenURL(appleUrl)
    if (canOpen) {
      await Linking.openURL(appleUrl)
      return
    }
  }

  if (Platform.OS === 'android') {
    // Try Google Maps (usually pre-installed)
    const googleUrl = `google.navigation:q=${dest}&mode=d`

    const canOpen = await Linking.canOpenURL(googleUrl)
    if (canOpen) {
      await Linking.openURL(googleUrl)
      return
    }
  }

  // Fallback: try Google Maps web
  const webUrl = latitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${dest}`

  const canOpenWeb = await Linking.canOpenURL(webUrl)
  if (canOpenWeb) {
    await Linking.openURL(webUrl)
    return
  }

  Alert.alert('No maps app', 'No navigation app found on your device.')
}

/**
 * Open a maps app to show a location (no navigation, just view)
 */
export async function openInMaps(options: {
  destination?: string
  latitude?: number
  longitude?: number
  label?: string
}) {
  const { destination, latitude, longitude, label } = options

  let dest = ''
  if (latitude != null && longitude != null) {
    dest = `${latitude},${longitude}`
  } else if (destination) {
    dest = encodeURIComponent(destination)
  } else {
    Alert.alert('No address', 'No address available.')
    return
  }

  if (Platform.OS === 'ios') {
    const url = `maps://?q=${dest}`
    if (await Linking.canOpenURL(url)) { await Linking.openURL(url); return }
  }

  if (Platform.OS === 'android') {
    const url = `geo:0,0?q=${dest}`
    if (await Linking.canOpenURL(url)) { await Linking.openURL(url); return }
  }

  // Web fallback
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${dest}`
  if (await Linking.canOpenURL(webUrl)) { await Linking.openURL(webUrl) }
}
