import { Platform, Alert, Linking } from 'react-native'

export interface MapApp {
  id: string
  name: string
  icon: string
  url: string
}

function buildDest(options: { destination?: string; latitude?: number; longitude?: number }) {
  const { destination, latitude, longitude } = options
  if (latitude != null && longitude != null) return { coord: `${latitude},${longitude}`, encoded: `${latitude},${longitude}` }
  if (destination) return { coord: destination, encoded: encodeURIComponent(destination) }
  return null
}

/**
 * Detect all installed map apps on the device and return them as a list.
 */
export async function detectMapApps(options: {
  destination?: string
  latitude?: number
  longitude?: number
  label?: string
}): Promise<MapApp[]> {
  const dest = buildDest(options)
  if (!dest) return []

  const apps: MapApp[] = []

  if (Platform.OS === 'ios') {
    // Apple Maps — always available on iOS
    const appleUrl = options.latitude != null
      ? `maps://?daddr=${dest.coord}&dirflg=d`
      : `maps://?q=${dest.encoded}`
    apps.push({ id: 'apple', name: 'Apple Maps', icon: '🗺', url: appleUrl })

    // Google Maps
    const gUrl = `comgooglemaps://?daddr=${dest.encoded}&directionsmode=driving`
    if (await Linking.canOpenURL(gUrl)) {
      apps.push({ id: 'google', name: 'Google Maps', icon: '📍', url: gUrl })
    }

    // Waze
    const wazeUrl = `waze://?ll=${dest.coord}&navigate=yes`
    if (await Linking.canOpenURL(wazeUrl)) {
      apps.push({ id: 'waze', name: 'Waze', icon: '💬', url: wazeUrl })
    }

    // Citymapper
    const citymapperUrl = `citymapper://directions?endcoord=${dest.coord}`
    if (await Linking.canOpenURL(citymapperUrl)) {
      apps.push({ id: 'citymapper', name: 'Citymapper', icon: '🚌', url: citymapperUrl })
    }
  }

  if (Platform.OS === 'android') {
    // Google Maps — usually pre-installed
    const googleUrl = `google.navigation:q=${dest.coord}&mode=d`
    apps.push({ id: 'google', name: 'Google Maps', icon: '📍', url: googleUrl })

    // Waze
    const wazeUrl = `waze://?ll=${dest.coord}&navigate=yes`
    if (await Linking.canOpenURL(wazeUrl)) {
      apps.push({ id: 'waze', name: 'Waze', icon: '💬', url: wazeUrl })
    }

    // HERE WeGo
    const hereUrl = `here.location://navigation?destination=${dest.coord}&mode=car`
    if (await Linking.canOpenURL(hereUrl)) {
      apps.push({ id: 'here', name: 'HERE WeGo', icon: '🧭', url: hereUrl })
    }

    // Mapfactor Navigator
    const mapfactorUrl = `navigator://navigation?lat=${options.latitude || 0}&lon=${options.longitude || 0}`
    if (await Linking.canOpenURL(mapfactorUrl)) {
      apps.push({ id: 'mapfactor', name: 'Navigator', icon: '🧭', url: mapfactorUrl })
    }
  }

  // Google Maps web — always available as final fallback
  const webUrl = options.latitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest.coord}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${dest.encoded}`
  apps.push({ id: 'web', name: 'Google Maps (Web)', icon: '🌐', url: webUrl })

  return apps
}

/**
 * Open a specific map app by URL.
 */
export async function openMapApp(url: string) {
  try {
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      await Linking.openURL(url)
    } else {
      Alert.alert('Cannot open', 'This app could not be opened.')
    }
  } catch {
    Alert.alert('Error', 'Could not open the maps app.')
  }
}

/**
 * Quick open — best available map (backward compatible).
 */
export async function openNavigation(options: {
  destination?: string
  latitude?: number
  longitude?: number
  label?: string
}) {
  const apps = await detectMapApps(options)
  if (apps.length === 0) {
    Alert.alert('No address', 'No destination address available for this visit.')
    return
  }
  // Open the first available (skipping web if native is available)
  const native = apps.find(a => a.id !== 'web')
  await openMapApp(native ? native.url : apps[0].url)
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
  const { destination, latitude, longitude } = options

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

  const webUrl = `https://www.google.com/maps/search/?api=1&query=${dest}`
  if (await Linking.canOpenURL(webUrl)) { await Linking.openURL(webUrl) }
}
