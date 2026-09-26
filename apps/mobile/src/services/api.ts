import Constants from 'expo-constants'
import { File, Paths } from 'expo-file-system'
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

// The endpoints that mint a session must never be retried through a refresh:
// a failed refresh that then refreshed again would recurse.
const SESSION_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout']

async function request<T>(path: string, options: RequestInit = {}, token?: string, isRetry = false): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  })
  const raw = await response.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  if (!response.ok) {
    // An access token lasts 15 minutes but the refresh token lasts 7 days.
    // Without this the carer is signed out mid-shift, and worse, reopening the
    // app after 15 minutes locks them out until they retype their password.
    if (response.status === 401 && token && !isRetry && !SESSION_ENDPOINTS.includes(path)) {
      const fresh = await refreshAccessToken()
      return request<T>(path, options, fresh, true)
    }
    throw new ApiError(response.status, data?.message || data?.error?.message || 'Request failed', data)
  }
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

/**
 * Refresh tokens are single-use — the server claims each one on first use and
 * refuses a replay. If several screens 401 at the same moment, only one of
 * them may refresh, so the rest wait on that same refresh and reuse its result.
 */
let refreshInFlight: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const session = await refreshSession()
      return session.accessToken
    } finally {
      refreshInFlight = null
    }
  })()
  try {
    return await refreshInFlight
  } catch (error) {
    // The refresh token is spent, revoked, or the account is no longer valid.
    // Nothing further can succeed, so drop the stored session and let the app
    // fall back to the sign-in screen rather than looping on dead tokens.
    await clearSession()
    throw error instanceof ApiError ? error : new ApiError(401, 'Your session has expired')
  }
}

export async function logout() {
  const session = await readSession()
  if (session?.accessToken) await request('/auth/logout', { method: 'POST' }, session.accessToken).catch(() => {})
  await clearSession()
}

/**
 * Deactivates the signed-in user's own account. This is the in-app account
 * deletion path Google Play requires for any app that lets people create an
 * account; without it the listing cannot be approved.
 */
export async function selfDeactivate(token: string): Promise<{ message: string }> {
  return request<{ message: string }>('/staff/self-deactivate', { method: 'POST' }, token)
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
  availability_date?: string | null
}

export async function getMyAvailability(token: string): Promise<AvailabilityRecord[]> {
  return request<AvailabilityRecord[]>('/homecare/my-availability', {}, token)
}

export async function addAvailability(token: string, dayOfWeek: number, startTime: string, endTime: string, isAvailable = true, availabilityDate?: string): Promise<AvailabilityRecord> {
  return request<AvailabilityRecord>('/homecare/availability', {
    method: 'POST',
    body: JSON.stringify({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, is_available: isAvailable, availability_date: availabilityDate || undefined }),
  }, token)
}

export async function getLeaveTypes(token: string): Promise<any[]> {
  return request<any[]>('/leave/types', {}, token)
}

export async function getMyLeaveRequests(token: string): Promise<any[]> {
  return request<any[]>('/leave/my-requests', {}, token)
}

export async function getLeaveRequests(token: string, status = 'pending'): Promise<any[]> {
  return request<any[]>(`/leave/requests?status=${encodeURIComponent(status)}`, {}, token)
}

export async function reviewLeaveRequest(token: string, id: string, status: 'approved' | 'rejected', notes?: string): Promise<any> {
  return request<any>(`/leave/requests/${encodeURIComponent(id)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes: notes || undefined }),
  }, token)
}

export async function getLeaveBalances(token: string): Promise<any[]> {
  return request<any[]>('/leave/balances', {}, token)
}

export async function createLeaveRequest(token: string, data: { leave_type_id: string; start_date: string; end_date: string; reason?: string; hours_requested?: number; duration_type?: 'days' | 'hours' }): Promise<any> {
  return request<any>('/leave/my-requests', { method: 'POST', body: JSON.stringify(data) }, token)
}

export async function cancelLeaveRequest(token: string, id: string): Promise<any> {
  return request<any>(`/leave/requests/${id}/cancel`, { method: 'PATCH' }, token)
}

export async function deleteAvailability(token: string, id: string): Promise<void> {
  await request(`/homecare/availability/${id}`, { method: 'DELETE' }, token)
}

export async function getPersonDetail(token: string, personId: string): Promise<any> {
  return request(`/people/${encodeURIComponent(personId)}`, {}, token)
}

export async function getMedicationsForPerson(token: string, personId: string): Promise<any[]> {
  const records = await request<any[]>(`/emedication/records?personId=${encodeURIComponent(personId)}`, {}, token)
  return Promise.all(records.map(async record => {
    if (Array.isArray(record.items)) return record
    try {
      return await request<any>(`/emedication/records/${encodeURIComponent(record.id)}`, {}, token)
    } catch {
      return record
    }
  }))
}

export async function getMedicationAdministrations(token: string, itemId: string, startDate?: string, endDate?: string): Promise<any[]> {
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const queryString = params.toString()
  return request<any[]>(`/emedication/items/${encodeURIComponent(itemId)}/administrations${queryString ? `?${queryString}` : ''}`, {}, token)
}

export async function createMedicationItem(token: string, recordId: string, data: {
  name: string
  dosage: string
  unit?: string
  route?: string
  frequency: string
  times?: string[]
  instructions?: string
  is_prn?: boolean
  is_active?: boolean
  start_date?: string
  end_date?: string
  reason_for_change: string
}): Promise<any> {
  return request(`/emedication/records/${encodeURIComponent(recordId)}/items`, { method: 'POST', body: JSON.stringify(data) }, token)
}

export async function updateMedicationItem(token: string, itemId: string, data: {
  name?: string
  dosage?: string
  unit?: string
  route?: string
  frequency?: string
  instructions?: string
  is_prn?: boolean
  is_active?: boolean
  start_date?: string
  end_date?: string
  reason_for_change: string
}): Promise<any> {
  return request(`/emedication/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: JSON.stringify(data) }, token)
}

export async function logMedicationAdministration(token: string, data: {
  emedication_item_id: string
  scheduled_time: string
  status: 'given' | 'refused' | 'missed'
  notes?: string
}): Promise<any> {
  return request('/emedication/administrations', { method: 'POST', body: JSON.stringify(data) }, token)
}

export async function getDailyNotes(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/daily-notes`, {}, token)
}

export async function getPersonAssessments(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/assessments`, {}, token)
}

export async function getPersonTimeline(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/timeline`, {}, token)
}

export async function getPersonDocuments(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/documents`, {}, token)
}

export async function getPersonClinicalScores(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/clinical-scores`, {}, token)
}

export async function getPersonWellbeing(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/wellbeing`, {}, token)
}

export async function getPersonCapacityAssessments(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/capacity`, {}, token)
}

export async function getPersonCarePathways(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/care-pathways`, {}, token)
}

export async function getPersonCommunicationLog(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/communication-log`, {}, token)
}

export async function getPersonTimeAway(token: string, personId: string): Promise<any[]> {
  return request<any[]>(`/people/${encodeURIComponent(personId)}/time-away`, {}, token)
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

/**
 * Colleagues a carer can swap, transfer or share a ride with. The manager-only
 * `/homecare/staff` directory is not readable by carers, so this uses the
 * carer-accessible colleagues endpoint instead.
 */
export async function getTeamMembers(token: string): Promise<TeamMember[]> {
  return request<TeamMember[]>('/homecare/colleagues', {}, token)
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

export async function getChatMessages(token: string, channel: string, limit = 50, before?: string): Promise<any> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', before)
  return request(`/chat/channels/${encodeURIComponent(channel)}/messages?${params}`, {}, token)
}

export async function sendChatMessage(token: string, channel: string, message: string, replyToId?: string, fileUrl?: string, fileName?: string): Promise<any> {
  return request(`/chat/channels/${encodeURIComponent(channel)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message, reply_to_id: replyToId, file_url: fileUrl, file_name: fileName }),
  }, token)
}

/**
 * Upload a native image as a real Blob/File. React Native 0.86 no longer
 * accepts the old `{ uri, name, type }` FormData part on every Android
 * runtime, which caused "unsupported FormDataPart implementation" errors.
 */
export async function uploadFile(token: string, endpoint: string, uri: string, fileName: string): Promise<{ url: string }> {
  const formData = new FormData()
  const file = new File(uri)
  formData.append('file', file, fileName)
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const raw = await response.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  if (!response.ok) throw new ApiError(response.status, data?.message || data?.error?.message || 'Upload failed', data)
  return data
}

export async function uploadChatFile(token: string, uri: string, fileName: string): Promise<{ url: string }> {
  return uploadFile(token, '/chat/upload', uri, fileName)
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

export async function getChatReadReceipts(token: string, channel: string): Promise<{ other_last_read_at: string | null; member_reads: any[] }> {
  return request(`/chat/channels/${encodeURIComponent(channel)}/read-receipts`, {}, token)
}

export async function markChatRead(token: string, channel: string): Promise<any> {
  return request(`/chat/channels/${encodeURIComponent(channel)}/read`, {
    method: 'POST',
  }, token)
}

export async function markChatDelivered(token: string, channel: string, messageIds: string[]): Promise<any> {
  return request(`/chat/channels/${encodeURIComponent(channel)}/delivered`, {
    method: 'POST',
    body: JSON.stringify({ messageIds }),
  }, token)
}

export function getApiOrigin(): string {
  return API_BASE_URL.replace(/\/api$/, '')
}

export function getApiFileUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl
  const origin = API_BASE_URL.replace(/\/api$/, '')
  return `${origin}${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`
}

export async function downloadChatFile(token: string, fileUrl: string, fileName: string): Promise<File> {
  const safeName = (fileName || 'chat-file').replace(/[^a-zA-Z0-9._-]/g, '_')
  const destination = new File(Paths.cache, `${Date.now()}-${safeName}`)
  return File.downloadFileAsync(getApiFileUrl(fileUrl), destination, {
    headers: authHeader(token),
    idempotent: true,
  })
}

/** Download a client document through the authenticated private-file endpoint. */
export async function downloadPersonDocument(token: string, fileUrl: string, fileName: string): Promise<File> {
  const safeName = (fileName || 'client-document').replace(/[^a-zA-Z0-9._-]/g, '_')
  const destination = new File(Paths.cache, `${Date.now()}-${safeName}`)
  return File.downloadFileAsync(getApiFileUrl(fileUrl), destination, {
    headers: authHeader(token),
    idempotent: true,
  })
}

export async function getChatUnread(token: string): Promise<Record<string, number>> {
  return request('/chat/unread', {}, token)
}

export async function getOrgMembers(token: string): Promise<any[]> {
  return request('/chat/org-members', {}, token)
}

export async function getChatChannelMembers(token: string, channelId: string): Promise<any[]> {
  return request(`/chat/channels/${encodeURIComponent(channelId)}/members`, {}, token)
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

/** Absolute URL of the carer's payslip PDF, for downloading to a file. */
export function myPayslipUrl(from: string, to: string): string {
  return `${API_BASE_URL}/homecare/my-payslip?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

// ── Manager endpoints ──
export async function getManagerDashboard(token: string, from: string, to: string): Promise<any> {
  const params = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const [visits, exceptions, staff, disruptions] = await Promise.all([
    request(`/homecare/visits?${params}`, {}, token),
    request('/homecare/exceptions', {}, token),
    request('/homecare/staff', {}, token),
    request('/homecare/disruptions?openOnly=true', {}, token),
  ])
  return { visits, exceptions, staff, disruptions }
}

export async function getClientList(token: string): Promise<any[]> {
  return request('/people/', {}, token)
}

export async function getClientDetail(token: string, personId: string): Promise<any> {
  return request(`/people/${personId}`, {}, token)
}

export async function getStaffDirectory(token: string): Promise<any[]> {
  return request('/staff/org-members', {}, token)
}

export async function getAllVisits(token: string, from: string, to: string, staffId?: string, status?: string): Promise<any[]> {
  let params = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  if (staffId) params += `&staffId=${encodeURIComponent(staffId)}`
  if (status) params += `&status=${encodeURIComponent(status)}`
  return request(`/homecare/visits?${params}`, {}, token)
}

export async function getOpenHomecareExceptions(token: string): Promise<any[]> {
  return request('/homecare/exceptions', {}, token)
}

export async function updateVisitStatus(token: string, visitId: string, data: any): Promise<any> {
  return request(`/homecare/visits/${visitId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, token)
}

export async function resolveException(token: string, visitId: string, data: any): Promise<any> {
  return request(`/homecare/visits/${visitId}/resolve-exception`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, token)
}

export async function getTimesheets(token: string, status?: string): Promise<any[]> {
  const params = status ? `?status=${status}` : ''
  return request(`/homecare/timesheets${params}`, {}, token)
}

export async function updateTimesheet(token: string, timesheetId: string, data: any): Promise<any> {
  return request(`/homecare/timesheets/${timesheetId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, token)
}

// ── Carer Totals (manager) ──
export async function getMonthlyCarerTotals(token: string, from: string, to: string): Promise<any[]> {
  return request(`/homecare/timesheets/monthly-totals?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, token)
}

export async function getCarerTimesheetDetail(token: string, staffId: string, from: string, to: string): Promise<any[]> {
  return request(`/homecare/timesheets/carer/${staffId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, token)
}

export async function getPendingTimesheets(token: string, from: string, to: string): Promise<any[]> {
  return request(`/homecare/timesheets/pending?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, token)
}

export async function approveTimesheet(token: string, timesheetId: string): Promise<any> {
  return request(`/homecare/timesheets/${timesheetId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved' }),
  }, token)
}

export async function rejectTimesheet(token: string, timesheetId: string, reason?: string): Promise<any> {
  return request(`/homecare/timesheets/${timesheetId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'rejected', rejection_reason: reason }),
  }, token)
}

// ── Ride Sharing ──
export async function listRideShareRequests(token: string): Promise<any[]> {
  return request('/homecare/ride-share-requests', {}, token)
}

export async function createRideShareRequest(token: string, visitId: string, targetVisitId: string, message?: string): Promise<any> {
  return request('/homecare/ride-share-requests', {
    method: 'POST',
    body: JSON.stringify({ visit_id: visitId, target_visit_id: targetVisitId, message }),
  }, token)
}

export async function respondRideShareRequest(token: string, requestId: string, status: 'accepted' | 'declined'): Promise<any> {
  return request(`/homecare/ride-share-requests/${requestId}/respond`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token)
}

/* ─── Open calls ────────────────────────────────────────────── */

export interface OpenCallAssignment {
  id: string
  staff_id: string
  status: string
  staff_name?: string | null
}

/** An unclaimed extra shift a care worker can pick up. */
export interface OpenCall {
  id: string
  location_id: string
  location_name?: string | null
  department_name?: string | null
  start_time: string
  end_time: string
  status: string
  shift_type: string
  person_id?: string | null
  su_first_name?: string | null
  su_last_name?: string | null
  staff_count?: number
  assignments?: OpenCallAssignment[]
}

/** Result of claiming. `auto_approved` is set when the claimant manages the location. */
export interface OpenCallClaim {
  id: string
  shift_id: string
  status: string
  requires_approval?: boolean
  auto_approved?: boolean
}

export async function getOpenCalls(token: string, params: { location_id?: string; date_from?: string; date_to?: string } = {}): Promise<OpenCall[]> {
  const query = new URLSearchParams()
  if (params.location_id) query.set('location_id', params.location_id)
  if (params.date_from) query.set('date_from', params.date_from)
  if (params.date_to) query.set('date_to', params.date_to)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<OpenCall[]>(`/shifts/open${suffix}`, {}, token)
}

/**
 * Claim an open call. The backend resolves the claimant from the session, so no
 * staff id is sent — a care worker can only ever claim on their own behalf.
 */
export async function claimOpenCall(token: string, shiftId: string): Promise<OpenCallClaim> {
  return request<OpenCallClaim>(`/shifts/${shiftId}/claim`, { method: 'POST' }, token)
}

/**
 * A claim this care worker has made, exactly as `GET /shifts/my-claims` returns
 * it. `assignment_status` is what the backend writes to `shift_assignments`:
 * 'pending' while a manager still has to approve, 'assigned' once approved (or
 * auto-approved), and 'rejected' once declined, cancelled or revoked. The web
 * app labels the same three, so mobile uses the same words.
 */
export interface MyOpenCallClaim {
  assignment_id: string
  assignment_status: string
  claimed_at?: string | null
  is_overtime?: boolean
  shift_id: string
  start_time: string
  end_time: string
  shift_status: string
  shift_type: string
  location_name?: string | null
  department_name?: string | null
  su_first_name?: string | null
  su_last_name?: string | null
  staff_id: string
  first_name?: string | null
  last_name?: string | null
}

/**
 * Every claim this care worker has made. The endpoint takes no date filter and
 * orders by start time descending, so a caller wanting upcoming work first has
 * to sort it itself.
 */
export async function getMyOpenCallClaims(token: string): Promise<MyOpenCallClaim[]> {
  return request<MyOpenCallClaim[]>('/shifts/my-claims', {}, token)
}
