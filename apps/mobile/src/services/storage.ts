import * as SecureStore from 'expo-secure-store'
import type { AuthSession, OfflineVisitAction } from '../types'

const SESSION_KEY = 'meticlecare.session'
const QUEUE_KEY = 'meticlecare.visit-queue'

export async function readSession(): Promise<AuthSession | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY)
  if (!value) return null
  try { return JSON.parse(value) as AuthSession } catch { return null }
}

export async function writeSession(session: AuthSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session))
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY)
}

export async function readQueue(): Promise<OfflineVisitAction[]> {
  const value = await SecureStore.getItemAsync(QUEUE_KEY)
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export async function writeQueue(queue: OfflineVisitAction[]) {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue))
}
