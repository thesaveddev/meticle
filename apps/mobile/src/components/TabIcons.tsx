import { View } from 'react-native'
import { colors } from '../theme'

const S = 22 // icon size

function Bar({ w, h, x, y, r = 2, c }: { w: number; h: number; x: number; y: number; r?: number; c: string }) {
  return <View style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, backgroundColor: c }} />
}

function Dot({ x, y, d = 4, c }: { x: number; y: number; d?: number; c: string }) {
  return <View style={{ position: 'absolute', left: x, top: y, width: d, height: d, borderRadius: d / 2, backgroundColor: c }} />
}

function Circle({ x, y, d, c, fill }: { x: number; y: number; d: number; c: string; fill?: string }) {
  return <View style={{ position: 'absolute', left: x, top: y, width: d, height: d, borderRadius: d / 2, backgroundColor: fill || 'transparent', borderWidth: fill ? 0 : 1.5, borderColor: c }} />
}

export function TabIcon({ name, size, color }: { name: 'today' | 'week' | 'mileage' | 'calendar' | 'settings'; size?: number; color: string }) {
  const active = color !== colors.subtle
  if (name === 'today') return <IconToday active={active} />
  if (name === 'week') return <IconWeek active={active} />
  if (name === 'mileage') return <IconMileage active={active} />
  if (name === 'calendar') return <IconAvailability active={active} />
  if (name === 'settings') return <IconSettings active={active} />
  return null
}

function IconToday({ active }: { active: boolean }) {
  const c = active ? colors.primary : colors.subtle
  return (
    <View style={{ width: S, height: S }}>
      {/* Clipboard body */}
      <Bar w={16} h={14} x={3} y={4} c={c} />
      <Bar w={8} h={3} x={7} y={1} c={c} r={1.5} />
      {/* Checklist lines */}
      <Bar w={8} h={1.5} x={5.5} y={8} c={colors.surface} />
      <Bar w={6} h={1.5} x={5.5} y={11.5} c={colors.surface} />
      <Bar w={7} h={1.5} x={5.5} y={15} c={colors.surface} />
    </View>
  )
}

export function IconWeek({ active }: { active: boolean }) {
  const c = active ? colors.primary : colors.subtle
  return (
    <View style={{ width: S, height: S }}>
      {/* Calendar body */}
      <Bar w={18} h={15} x={2} y={4} c={c} />
      <Bar w={18} h={4} x={2} y={4} c={c} r={2} />
      {/* Calendar rings */}
      <Bar w={2} h={4} x={7} y={2} c={c} r={1} />
      <Bar w={2} h={4} x={13} y={2} c={c} r={1} />
      {/* Grid dots */}
      <Dot x={6} y={12} c={colors.surface} />
      <Dot x={10} y={12} c={colors.surface} />
      <Dot x={14} y={12} c={colors.surface} />
      <Dot x={6} y={16} c={colors.surface} />
      <Dot x={10} y={16} c={colors.surface} />
    </View>
  )
}

export function IconMileage({ active }: { active: boolean }) {
  const c = active ? colors.primary : colors.subtle
  return (
    <View style={{ width: S, height: S }}>
      {/* Road */}
      <Bar w={2} h={14} x={10} y={5} c={c} />
      {/* Car body */}
      <Bar w={12} h={6} x={5} y={9} c={c} r={2} />
      {/* Car roof */}
      <Bar w={8} h={4} x={7} y={5} c={c} r={1.5} />
      {/* Wheels */}
      <Dot x={6} y={15} d={3} c={c} />
      <Dot x={13} y={15} d={3} c={c} />
    </View>
  )
}

export function IconAvailability({ active }: { active: boolean }) {
  const c = active ? colors.primary : colors.subtle
  return (
    <View style={{ width: S, height: S }}>
      {/* Clock face */}
      <Circle x={1} y={1} d={20} c={c} />
      {/* Clock hands */}
      <Bar w={1.5} h={7} x={9.25} y={4} c={c} r={1} />
      <Bar w={6} h={1.5} x={9.25} y={9.25} c={c} r={1} />
      <Dot x={9} y={9} d={2.5} c={c} />
    </View>
  )
}

export function IconSettings({ active }: { active: boolean }) {
  const c = active ? colors.primary : colors.subtle
  return (
    <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
      {/* Gear teeth — 8 bars around center */}
      <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: c, position: 'absolute' }} />
      {/* Top tooth */}
      <Bar w={2.5} h={4} x={9.75} y={1} c={c} r={1} />
      {/* Bottom tooth */}
      <Bar w={2.5} h={4} x={9.75} y={17} c={c} r={1} />
      {/* Left tooth */}
      <Bar w={4} h={2.5} x={1} y={9.75} c={c} r={1} />
      {/* Right tooth */}
      <Bar w={4} h={2.5} x={17} y={9.75} c={c} r={1} />
      {/* Diagonal teeth */}
      <Bar w={2.5} h={3} x={4} y={2.5} c={c} r={1} />
      <Bar w={2.5} h={3} x={15.5} y={2.5} c={c} r={1} />
      <Bar w={2.5} h={3} x={4} y={16.5} c={c} r={1} />
      <Bar w={2.5} h={3} x={15.5} y={16.5} c={c} r={1} />
    </View>
  )
}
