import * as Location from 'expo-location'
import { isCaptureMode } from '../capture/mode'

/**
 * A position for the capture screenshots, standing in for the client's address.
 * Real coordinates would be a client's address in a public store listing, and
 * a real fix would need a device that is physically at that address.
 */
const CAPTURE_POSITION = { latitude: 53.4351, longitude: -2.2758, accuracy_meters: 8 }
/** A believable "you have arrived" distance: inside the 150 m check-in threshold. */
const CAPTURE_DISTANCE_METERS = 42

/**
 * A single position fix.
 *
 * Callers must only reach for this at a moment the carer asked for it. It is
 * the function that took a permission prompt and a GPS read; wrapping it in a
 * subscription is what turned a location check into tracking.
 */
export async function getVisitLocation() {
  if (isCaptureMode()) return { ...CAPTURE_POSITION }
  const permission = await Location.requestForegroundPermissionsAsync()
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Location permission is needed to verify this visit.')
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy_meters: position.coords.accuracy || undefined,
  }
}

/** Haversine distance in meters between two coordinates */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Format distance for display */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

/**
 * Distance from the device to a target, measured once, on demand.
 *
 * This is deliberately a single fix rather than a subscription. It used to be
 * `watchPositionAsync` at 5 s / 10 m for as long as the visit screen was open,
 * which meant the app read the device's position continuously between arriving
 * and checking in. That was removed 27 Sep 2026: continuous collection between
 * the two buttons is tracking, not a location check, and the feature does not
 * need it.
 *
 * The only moments the app reads position are now:
 *   1. the carer pressing Check in or Check out,
 *   2. the carer tapping "Check my distance" on this function, and
 *   3. the carer opening the navigation modal (see MapPickerModal).
 *
 * Every one of those is a deliberate act by the person being located, and
 * nothing runs between them. See docs/DPIA_Live_Active_Visit_Map.md.
 */
export async function measureVisitDistance(
  targetLat: number,
  targetLon: number
): Promise<{ distance: number; accuracy: number | null }> {
  // Capture mode must not raise a location permission dialog over a screenshot,
  // and a simulator has no meaningful position to read anyway.
  if (isCaptureMode()) {
    return { distance: CAPTURE_DISTANCE_METERS, accuracy: CAPTURE_POSITION.accuracy_meters }
  }

  const here = await getVisitLocation()
  return {
    distance: haversineDistance(here.latitude, here.longitude, targetLat, targetLon),
    accuracy: here.accuracy_meters ?? null,
  }
}
