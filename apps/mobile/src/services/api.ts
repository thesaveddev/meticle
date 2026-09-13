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

export async function getStaffVisits(token: string, staffId: string, from: string, to: string) {
  return request<HomecareVisit[]>(`/homecare/staff-visits/${staffId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, token)
}

export async function getLocationThreshold(token: string): Promise<number> {
  const res = await request<{ location_threshold_meters: number }>('/homecare/settings/location-threshold', {}, token)
  return res.location_threshold_meters || 500
}

export async function setLocationThreshold(token: string, meters: number): Promise<void> {
  await request('/homecare/settings/location-threshold', { method: 'PATCH', body: JSON.stringify({ location_threshold_meters: meters }) }, token)
}

export async function getRequirePhoto(token: string): Promise<boolean> {
  const res = await request<{ require_photo_on_checkout: boolean }>('/homecare/settings/require-photo', {}, token)
  return res.require_photo_on_checkout || false
}

export async function setRequirePhoto(token: string, required: boolean): Promise<void> {
  await request('/homecare/settings/require-photo', { method: 'PATCH', body: JSON.stringify({ require_photo_on_checkout: required }) }, token)
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

export interface AvailabilityRecord {
  id: string
  staff_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

export async function getMyAvailability(token: string): Promise<AvailabilityRecord[]> {
  return request<AvailabilityRecord[]>('/homecare/my-availability', {}, token)
}

export async function addAvailability(token: string, dayOfWeek: number, startTime: string, endTime: string): Promise<AvailabilityRecord> {
  return request<AvailabilityRecord>('/homecare/availability', {
    method: 'POST',
    body: JSON.stringify({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime }),
  }, token)
}

export async function deleteAvailability(token: string, id: string): Promise<void> {
  await request(`/homecare/availability/${id}`, { method: 'DELETE' }, token)
}

export async function getPersonDetail(token: string, personId: string): Promise<any> {
  return request(`/people/${encodeURIComponent(personId)}`, {}, token)
}

export async function getMedicationsForPerson(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/emedication/records?personId=${encodeURIComponent(personId)}`, {}, token)
}

/* ─── Body Map ───────────────────────────────────────────── */
import type { BodyMapEntry, BodyMapStats } from '../types'

export async function getBodyMapEntries(token: string, personId: string): Promise<BodyMapEntry[]> {
  return request<BodyMapEntry[]>(`/body-map/person/${encodeURIComponent(personId)}`, {}, token)
}

export async function getBodyMapActive(token: string, personId: string): Promise<BodyMapEntry[]> {
  return request<BodyMapEntry[]>(`/body-map/person/${encodeURIComponent(personId)}/active`, {}, token)
}

export async function getBodyMapStats(token: string, personId: string): Promise<BodyMapStats> {
  return request<BodyMapStats>(`/body-map/person/${encodeURIComponent(personId)}/stats`, {}, token)
}

export async function createBodyMapEntry(token: string, data: {
  person_id: string
  body_view: 'front' | 'back'
  body_zone: string
  zone_x?: number
  zone_y?: number
  condition_type: string
  description?: string
  severity?: string
}): Promise<BodyMapEntry> {
  return request<BodyMapEntry>('/body-map', { method: 'POST', body: JSON.stringify(data) }, token)
}

export async function updateBodyMapEntry(token: string, entryId: string, data: {
  status?: string
  description?: string
  severity?: string
}): Promise<BodyMapEntry> {
  return request<BodyMapEntry>(`/body-map/${entryId}`, { method: 'PATCH', body: JSON.stringify(data) }, token)
}

/* ─── Nutrition ───────────────────────────────────────────── */
import type { DietaryProfile, MealRecord, NutritionSummary } from '../types'

export async function getDietaryProfile(token: string, personId: string): Promise<DietaryProfile | null> {
  return request<DietaryProfile | null>(`/nutrition/${encodeURIComponent(personId)}/dietary-profile`, {}, token)
}

export async function getMealRecords(token: string, personId: string, from?: string, to?: string): Promise<MealRecord[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return request<MealRecord[]>(`/nutrition/${encodeURIComponent(personId)}/meals${qs ? '?' + qs : ''}`, {}, token)
}

export async function getDailySummary(token: string, personId: string): Promise<NutritionSummary> {
  return request<NutritionSummary>(`/nutrition/${encodeURIComponent(personId)}/meals/summary`, {}, token)
}

export async function createMealRecord(token: string, personId: string, data: {
  meal_type: string
  meal_time?: string
  notes?: string
  appetite_level?: string
  amount_offered?: string
  amount_consumed?: string
  consumed_percent?: number
  refused?: boolean
  refusal_reason?: string
  fluid_ml?: number
}): Promise<MealRecord> {
  return request<MealRecord>(`/nutrition/${encodeURIComponent(personId)}/meals`, { method: 'POST', body: JSON.stringify(data) }, token)
}

/* ─── Team (for managers) ──────────────────────────────────── */
import type { TeamMember } from '../types'

export async function getTeamMembers(token: string): Promise<TeamMember[]> {
  return request<TeamMember[]>('/homecare/staff', {}, token)
}

/* ─── Visit update with new fields ─────────────────────────── */
export async function updateVisit(token: string, visitId: string, data: Record<string, unknown>): Promise<any> {
  return request(`/homecare/visits/${visitId}`, { method: 'PATCH', body: JSON.stringify(data) }, token)
}

/* ─── Swap / Transfer ─────────────────────────────────────── */
export async function createSwapRequest(token: string, data: {
  visit_id: string
  target_staff_id?: string
  request_type: 'swap' | 'transfer'
  message?: string
}): Promise<any> {
  return request('/homecare/swap-requests', { method: 'POST', body: JSON.stringify(data) }, token)
}

export async function getSwapRequests(token: string): Promise<any[]> {
  return request<any[]>('/homecare/swap-requests', {}, token)
}

export async function respondSwapRequest(token: string, swapId: string, status: 'accepted' | 'rejected', message?: string): Promise<any> {
  return request(`/homecare/swap-requests/${swapId}/respond`, {
    method: 'PATCH',
    body: JSON.stringify({ status, response_message: message }),
  }, token)
}

/* ─── Notifications ───────────────────────────────────────── */
export async function getCarerNotifications(token: string): Promise<any[]> {
  return request<any[]>('/homecare/notifications', {}, token)
}

export async function markNotificationsRead(token: string): Promise<void> {
  await request('/homecare/notifications/read', { method: 'POST' }, token)
}

/* ─── Incidents ───────────────────────────────────────────── */
export async function reportIncident(token: string, data: {
  title: string
  description?: string
  category_id?: string
  severity: string
  location?: string
  is_near_miss?: boolean
  incident_date: string
  incident_time?: string
  person_ids?: string[]
}): Promise<any> {
  return request('/incidents', { method: 'POST', body: JSON.stringify(data) }, token)
}

// ── Notifications ──
export async function getMyNotifications(token: string): Promise<any[]> {
  return request('/notifications', {}, token)
}

export async function getUnreadNotificationCount(token: string): Promise<number> {
  return request('/notifications/unread-count', {}, token)
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  await request(`/notifications/${id}/read`, { method: 'PATCH' }, token)
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await request('/notifications/read-all', { method: 'PATCH' }, token)
}

// ── Chat ──
export async function ensureGeneralChannel(token: string): Promise<any> {
  return request('/chat/ensure-general', { method: 'POST' }, token)
}

export async function getChatChannels(token: string): Promise<any[]> {
  return request('/chat/channels', {}, token)
}

export async function getChatMessages(token: string, channel: string, limit = 50, before?: string): Promise<any[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', before)
  return request(`/chat/channels/${encodeURIComponent(channel)}/messages?${params}`, {}, token)
}

export async function sendChatMessage(token: string, channel: string, message: string, replyToId?: string): Promise<any> {
  return request(`/chat/channels/${encodeURIComponent(channel)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message, reply_to_id: replyToId }),
  }, token)
}

export async function editChatMessage(token: string, messageId: string, message: string): Promise<any> {
  return request(`/chat/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ message }),
  }, token)
}

export async function deleteChatMessage(token: string, messageId: string): Promise<any> {
  return request(`/chat/messages/${messageId}`, { method: 'DELETE' }, token)
}

export async function markChatRead(token: string, channel: string): Promise<any> {
  return request(`/chat/channels/${channel}/read`, {
    method: 'POST',
  }, token)
}

export async function getChatUnread(token: string): Promise<Record<string, number>> {
  return request('/chat/unread', {}, token)
}

export async function getOrgMembers(token: string): Promise<any[]> {
  return request('/chat/org-members', {}, token)
}

export async function createDMChannel(token: string, targetUserId: string): Promise<any> {
  return request(`/chat/channels/dm/${targetUserId}`, { method: 'POST' }, token)
}

export async function createGroupChannel(token: string, name: string, memberIds: string[]): Promise<any> {
  return request('/chat/groups', {
    method: 'POST',
    body: JSON.stringify({ name, memberIds }),
  }, token)
}

export async function searchChatMessages(token: string, query: string): Promise<any[]> {
  return request(`/chat/search?q=${encodeURIComponent(query)}`, {}, token)
}

// ── Visit tasks ──
export async function getVisitTasks(token: string, visitId: string): Promise<any[]> {
  return request(`/homecare/visits/${visitId}/tasks`, {}, token)
}

export async function addVisitTask(token: string, visitId: string, label: string): Promise<any> {
  return request(`/homecare/visits/${visitId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  }, token)
}

export async function toggleVisitTask(token: string, visitId: string, taskId: string, done: boolean): Promise<any> {
  return request(`/homecare/visits/${visitId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ done }),
  }, token)
}

export async function deleteVisitTask(token: string, visitId: string, taskId: string): Promise<void> {
  return request(`/homecare/visits/${visitId}/tasks/${taskId}`, {
    method: 'DELETE',
  }, token)
}

// ── Earnings ──
export async function getMyEarnings(token: string, from: string, to: string): Promise<any> {
  return request(`/homecare/my-earnings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, token)
}
