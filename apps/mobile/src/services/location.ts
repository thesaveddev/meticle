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
