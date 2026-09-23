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
  chat: 'Communication',
  tasks: 'Tasks',
  appointments: 'Appointments',
  expenses: 'Expenses',
  homecare: 'Domiciliary Care',
  room_checks: 'Room Checks',
  settings: 'Settings',
  billing: 'Billing',
  learn: 'Learning Center',
  call_scheduling: 'Call Scheduling',
  mileage_travel: 'Mileage & Travel',
  payroll_export: 'Payroll & Timesheets',
  client_billing: 'Client Billing',
}

const LEVEL_LABELS: Record<string, string> = {
  none: 'Disallowed',
  view: 'View Only',
  edit: 'Can Edit',
}

export function formatPermissionLabel(module: string): string {
  const known = MODULE_LABELS[module]
  if (known) return known
  return module
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

export { MODULE_LABELS, LEVEL_LABELS }

export type PermissionLevel = 'none' | 'view' | 'edit'
export type RolePermissionDefaults = Record<string, Record<string, PermissionLevel>>

export async function fetchUserPermissions(userId: string): Promise<{
  permissions: Array<{ module: string; permission_level: PermissionLevel }>
  role: string
  role_defaults?: RolePermissionDefaults
}> {
  const res = await api.get(`/permissions/${userId}`)
  return res.data
}

export async function updateUserPermissions(userId: string, permissions: Array<{ module: string; permission_level: PermissionLevel }>) {
  await api.put(`/permissions/${userId}`, { permissions })
}
