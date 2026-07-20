import api from '../services/api'

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  staff_directory: 'Staff Directory',
  compliance: 'Compliance',
  scheduling: 'Rota Planner',
  marketplace: 'Marketplace',
  reporting: 'Insights',
  settings: 'Settings',
  leave: 'Leave Manager',
}

const LEVEL_LABELS: Record<string, string> = {
  none: 'Disallowed',
  view: 'View Only',
  edit: 'Can Edit',
}

export { MODULE_LABELS, LEVEL_LABELS }

export async function fetchUserPermissions(userId: string): Promise<{ permissions: Array<{ module: string; permission_level: string }>; role: string }> {
  const res = await api.get(`/permissions/${userId}`)
  return res.data
}

export async function updateUserPermissions(userId: string, permissions: Array<{ module: string; permission_level: string }>) {
  await api.put(`/permissions/${userId}`, { permissions })
}
