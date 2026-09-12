import * as Location from 'expo-location'

export async function getVisitLocation() {
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
