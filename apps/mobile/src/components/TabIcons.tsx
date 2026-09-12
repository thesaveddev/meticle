import { Ionicons } from '@expo/vector-icons'

type TabName = 'today' | 'week' | 'mileage' | 'calendar' | 'settings'

// HIG: "Prefer filled symbols or icons for consistency with the platform"
const iconMap: Record<TabName, keyof typeof Ionicons.glyphMap> = {
  today: 'document-text',      // clipboard/document
  week: 'calendar',            // calendar
  mileage: 'car-sport',        // car
  calendar: 'time',            // clock/time
  settings: 'settings',        // gear
}

export function TabIcon({ name, size, color }: { name: TabName; size?: number; color: string }) {
  return <Ionicons name={iconMap[name]} size={size ?? 24} color={color} />
}
