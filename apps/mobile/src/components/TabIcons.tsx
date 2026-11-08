import { Ionicons } from '@expo/vector-icons'

type TabName = 'today' | 'week' | 'chat' | 'mileage' | 'calendar' | 'settings' | 'policies'

// HIG: "Prefer filled symbols or icons for consistency with the platform"
const iconMap: Record<TabName, keyof typeof Ionicons.glyphMap> = {
  today: 'document-text',      // clipboard/document
  week: 'calendar',            // calendar
  chat: 'chatbubbles',         // chat bubbles
  mileage: 'car-sport',        // car
  calendar: 'time',            // clock/time
  settings: 'settings',        // gear
  policies: 'shield-checkmark', // a policy is something you are held to
}

export function TabIcon({ name, size, color }: { name: TabName; size?: number; color: string }) {
  return <Ionicons name={iconMap[name]} size={size ?? 24} color={color} />
}
