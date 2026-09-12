import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'
const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials'

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync()
  const enrolled = await LocalAuthentication.isEnrolledAsync()
  return compatible && enrolled
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)
  return val === 'true'
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false')
}

export async function saveCredentials(email: string, password: string): Promise<void> {
  const creds = JSON.stringify({ email, password })
  await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, creds)
}

export async function loadCredentials(): Promise<{ email: string; password: string } | null> {
  const raw = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY)
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY)
}

export async function authenticateWithBiometrics(promptMessage = 'Sign in with biometrics'): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  if (!hasHardware) return false

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Use password',
    disableDeviceFallback: false,
    fallbackLabel: 'Use password',
  })

  return result.success
}

export function getBiometricTypeLabel(): string {
  if (Platform.OS === 'ios') return 'Face ID'
  return 'Fingerprint'
}
