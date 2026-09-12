import { Ionicons } from '@expo/vector-icons'

type TabName = 'today' | 'week' | 'mileage' | 'calendar' | 'settings'

const iconMap: Record<TabName, keyof typeof Ionicons.glyphMap> = {
  today: 'document-text',
  week: 'calendar',
  mileage: 'car',
  calendar: 'time',
  settings: 'settings-sharp',
}

export function TabIcon({ name, size, color }: { name: TabName; size?: number; color: string }) {
  return <Ionicons name={iconMap[name]} size={size ?? 22} color={color} />
}
