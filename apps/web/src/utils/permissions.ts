import api from '../services/api'

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  people: 'People & Care Records',
  emedication: 'Medications (eMAR)',
  staff_directory: 'Staff Directory',
  scheduling: 'Rota Planner',
  marketplace: 'Shift Marketplace',
  agencies: 'Agencies',
  leave: 'Leave Manager',
  compliance: 'Compliance',
  training: 'Training',
  policies: 'Policies',
  incidents: 'Incidents',
  reporting: 'Reports & Insights',
  outcomes: 'Outcomes',
  chat: 'Communication',
  tasks: 'Tasks',
  appointments: 'Appointments',
  expenses: 'Expenses',
  room_checks: 'Room Checks',
  settings: 'Settings',
  billing: 'Billing',
  learn: 'Learning Center',
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
