import Constants from 'expo-constants'
import type { AuthSession, HomecareVisit, MobileUser } from '../types'
import { clearSession, readSession, writeSession } from './storage'

const configuredBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || configuredBaseUrl || 'https://meticlecare.com/api').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  data: any
  constructor(status: number, message: string, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  })
  const raw = await response.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  if (!response.ok) throw new ApiError(response.status, data?.message || data?.error?.message || 'Request failed', data)
  return data as T
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const session = await request<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }) })
  if (!session.accessToken || !session.refreshToken || !session.user) throw new ApiError(502, 'The server returned an incomplete login response')
  await writeSession(session)
  return session
}

export async function refreshSession(): Promise<AuthSession> {
  const current = await readSession()
  if (!current?.refreshToken) throw new ApiError(401, 'Your session has expired')
  const refreshed = await request<{ accessToken: string; refreshToken: string }>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: current.refreshToken }) })
  const session = { ...current, ...refreshed }
  await writeSession(session)
  return session
}

export async function logout() {
  const session = await readSession()
  if (session?.accessToken) await request('/auth/logout', { method: 'POST' }, session.accessToken).catch(() => {})
  await clearSession()
}

export async function getCurrentUser(token: string) {
  const result = await request<{ user: MobileUser; organization?: Record<string, unknown> | null }>('/auth/me', {}, token)
  return result
}

export async function getMyVisits(token: string, from: string, to: string) {
  return request<HomecareVisit[]>(`/homecare/my-visits?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, token)
}

export async function executeVisitAction(token: string, visitId: string, action: 'check-in' | 'check-out', payload: Record<string, unknown>, actionKey: string) {
  return request(`/homecare/visits/${visitId}/offline/${action}`, { method: 'POST', body: JSON.stringify({ ...payload, action_key: actionKey }) }, token)
}

export async function createDisruption(token: string, visitId: string, body: Record<string, unknown>) {
  return request(`/homecare/visits/${visitId}/disruptions`, { method: 'POST', body: JSON.stringify(body) }, token)
}

export interface CarePlan {
  id: string
  title: string
  category: string
  status: string
  review_date: string | null
}

export async function getCarePlans(token: string, personId: string): Promise<CarePlan[]> {
  return request<CarePlan[]>(`/homecare/care-plans?personId=${encodeURIComponent(personId)}`, {}, token)
}
