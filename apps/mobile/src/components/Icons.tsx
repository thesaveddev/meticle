import React from 'react'
import { View } from 'react-native'

interface IconProps {
  size?: number
  color?: string
  strokeWidth?: number
}

// Helper: rounded line segment
function Line({ x1, y1, x2, y2, stroke, strokeWidth = 2, strokeLinecap = 'round' }: {
  x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth?: number; strokeLinecap?: string
}) {
  return <View style={{ position: 'absolute', left: x1, top: y1, width: Math.abs(x2 - x1) || strokeWidth, height: Math.abs(y2 - y1) || strokeWidth, backgroundColor: stroke, borderRadius: strokeWidth / 2 }} />
}

// ─── Tab Icons ───────────────────────────────────────────────

export function IconToday({ size = 24, color = '#1C1917' }: IconProps) {
  const s = size / 24
  return (
    <View style={{ width: size, height: size }}>
      {/* Clipboard body */}
      <View style={{ position: 'absolute', left: 4 * s, top: 3 * s, width: 16 * s, height: 17 * s, borderRadius: 3 * s, borderWidth: 2 * s, borderColor: color }} />
      {/* Clip */}
      <View style={{ position: 'absolute', left: 8 * s, top: 0, width: 8 * s, height: 5 * s, borderRadius: 2 * s, borderWidth: 2 * s, borderColor: color, borderBottomWidth: 0, backgroundColor: 'transparent' }} />
      {/* Lines */}
      <View style={{ position: 'absolute', left: 7 * s, top: 10 * s, width: 10 * s, height: 1.5 * s, backgroundColor: color, borderRadius: 1 * s }} />
      <View style={{ position: 'absolute', left: 7 * s, top: 14 * s, width: 7 * s, height: 1.5 * s, backgroundColor: color, borderRadius: 1 * s }} />
      <View style={{ position: 'absolute', left: 7 * s, top: 18 * s, width: 8 * s, height: 1.5 * s, backgroundColor: color, borderRadius: 1 * s }} />
    </View>
  )
}

export function IconWeek({ size = 24, color = '#1C1917' }: IconProps) {
  const s = size / 24
  return (
    <View style={{ width: size, height: size }}>
      {/* Calendar body */}
      <View style={{ position: 'absolute', left: 2 * s, top: 4 * s, width: 20 * s, height: 17 * s, borderRadius: 3 * s, borderWidth: 2 * s, borderColor: color }} />
      {/* Header bar */}
      <View style={{ position: 'absolute', left: 2 * s, top: 4 * s, width: 20 * s, height: 5 * s, borderRadius: 3 * s, backgroundColor: color }} />
      {/* Rings */}
      <View style={{ position: 'absolute', left: 7 * s, top: 1 * s, width: 2 * s, height: 5 * s, borderRadius: 1 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 15 * s, top: 1 * s, width: 2 * s, height: 5 * s, borderRadius: 1 * s, backgroundColor: color }} />
      {/* Dots */}
      <View style={{ position: 'absolute', left: 7 * s, top: 13 * s, width: 2 * s, height: 2 * s, borderRadius: 1 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 11 * s, top: 13 * s, width: 2 * s, height: 2 * s, borderRadius: 1 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 15 * s, top: 13 * s, width: 2 * s, height: 2 * s, borderRadius: 1 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 7 * s, top: 17 * s, width: 2 * s, height: 2 * s, borderRadius: 1 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 11 * s, top: 17 * s, width: 2 * s, height: 2 * s, borderRadius: 1 * s, backgroundColor: color }} />
    </View>
  )
}

export function IconMileage({ size = 24, color = '#1C1917' }: IconProps) {
  const s = size / 24
  return (
    <View style={{ width: size, height: size }}>
      {/* Road line */}
      <View style={{ position: 'absolute', left: 11 * s, top: 2 * s, width: 2 * s, height: 20 * s, backgroundColor: color, borderRadius: 1 * s }} />
      {/* Car body */}
      <View style={{ position: 'absolute', left: 4 * s, top: 10 * s, width: 16 * s, height: 7 * s, borderRadius: 3 * s, backgroundColor: color }} />
      {/* Car roof */}
      <View style={{ position: 'absolute', left: 7 * s, top: 6 * s, width: 10 * s, height: 5 * s, borderRadius: 2 * s, backgroundColor: color }} />
      {/* Windows */}
      <View style={{ position: 'absolute', left: 8 * s, top: 7 * s, width: 3 * s, height: 3 * s, borderRadius: 1 * s, backgroundColor: 'white' }} />
      <View style={{ position: 'absolute', left: 13 * s, top: 7 * s, width: 3 * s, height: 3 * s, borderRadius: 1 * s, backgroundColor: 'white' }} />
    </View>
  )
}

export function IconSchedule({ size = 24, color = '#1C1917' }: IconProps) {
  const s = size / 24
  return (
    <View style={{ width: size, height: size }}>
      {/* Clock face */}
      <View style={{ position: 'absolute', left: 1 * s, top: 1 * s, width: 22 * s, height: 22 * s, borderRadius: 11 * s, borderWidth: 2 * s, borderColor: color }} />
      {/* Hour hand */}
      <View style={{ position: 'absolute', left: 11 * s, top: 6 * s, width: 2 * s, height: 7 * s, backgroundColor: color, borderRadius: 1 * s }} />
      {/* Minute hand */}
      <View style={{ position: 'absolute', left: 11 * s, top: 11 * s, width: 7 * s, height: 2 * s, backgroundColor: color, borderRadius: 1 * s }} />
      {/* Center dot */}
      <View style={{ position: 'absolute', left: 10.5 * s, top: 10.5 * s, width: 3 * s, height: 3 * s, borderRadius: 1.5 * s, backgroundColor: color }} />
    </View>
  )
}

export function IconSettings({ size = 24, color = '#1C1917' }: IconProps) {
  const s = size / 24
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Gear body */}
      <View style={{ width: 10 * s, height: 10 * s, borderRadius: 5 * s, borderWidth: 2.5 * s, borderColor: color }} />
      {/* Teeth */}
      <View style={{ position: 'absolute', left: 10.5 * s, top: 0, width: 3 * s, height: 4 * s, borderRadius: 1 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 10.5 * s, top: 20 * s, width: 3 * s, height: 4 * s, borderRadius: 1 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 0, top: 10.5 * s, width: 4 * s, height: 3 * s, borderRadius: 1 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 20 * s, top: 10.5 * s, width: 4 * s, height: 3 * s, borderRadius: 1 * s, backgroundColor: color }} />
      {/* Diagonal teeth */}
      <View style={{ position: 'absolute', left: 3 * s, top: 3 * s, width: 3 * s, height: 3 * s, borderRadius: 1 * s, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', left: 18 * s, top: 3 * s, width: 3 * s, height: 3 * s, borderRadius: 1 * s, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', left: 3 * s, top: 18 * s, width: 3 * s, height: 3 * s, borderRadius: 1 * s, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', left: 18 * s, top: 18 * s, width: 3 * s, height: 3 * s, borderRadius: 1 * s, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  )
}

// ─── Status Icons ────────────────────────────────────────────

export function IconCheck({ size = 16, color = '#16A34A' }: IconProps) {
  const s = size / 16
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 14 * s, height: 14 * s, borderRadius: 7 * s, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 4 * s, height: 7 * s, borderRightWidth: 2 * s, borderBottomWidth: 2 * s, borderColor: 'white', transform: [{ rotate: '45deg' }], marginTop: -1 * s }} />
      </View>
    </View>
  )
}

export function IconClock({ size = 16, color = '#2D3A8C' }: IconProps) {
  const s = size / 16
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: 14 * s, height: 14 * s, borderRadius: 7 * s, borderWidth: 1.5 * s, borderColor: color, top: 1 * s, left: 1 * s, position: 'absolute' }} />
      <View style={{ position: 'absolute', left: 7.5 * s, top: 4 * s, width: 1.5 * s, height: 4 * s, backgroundColor: color, borderRadius: 1 * s }} />
      <View style={{ position: 'absolute', left: 7.5 * s, top: 7 * s, width: 3.5 * s, height: 1.5 * s, backgroundColor: color, borderRadius: 1 * s }} />
    </View>
  )
}

export function IconAlert({ size = 16, color = '#DC2626' }: IconProps) {
  const s = size / 16
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: 14 * s, height: 14 * s, borderRadius: 7 * s, backgroundColor: color, top: 1 * s, left: 1 * s, position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 1.5 * s, height: 5 * s, backgroundColor: 'white', borderRadius: 1 * s, position: 'absolute', top: 3 * s }} />
        <View style={{ width: 1.5 * s, height: 1.5 * s, borderRadius: 0.75 * s, backgroundColor: 'white', position: 'absolute', top: 9.5 * s }} />
      </View>
    </View>
  )
}

export function IconSync({ size = 16, color = '#16A34A' }: IconProps) {
  const s = size / 16
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: 12 * s, height: 12 * s, borderRadius: 6 * s, borderWidth: 1.5 * s, borderColor: color, top: 2 * s, left: 2 * s, position: 'absolute' }} />
      <View style={{ position: 'absolute', left: 6 * s, top: 0, width: 4 * s, height: 3 * s, backgroundColor: color, borderRadius: 1.5 * s }} />
    </View>
  )
}

// ─── Action Icons ────────────────────────────────────────────

export function IconCamera({ size = 20, color = '#2D3A8C' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size }}>
      {/* Body */}
      <View style={{ position: 'absolute', left: 1 * s, top: 5 * s, width: 18 * s, height: 12 * s, borderRadius: 2 * s, borderWidth: 1.5 * s, borderColor: color }} />
      {/* Lens */}
      <View style={{ position: 'absolute', left: 6 * s, top: 8 * s, width: 8 * s, height: 8 * s, borderRadius: 4 * s, borderWidth: 1.5 * s, borderColor: color }} />
      <View style={{ position: 'absolute', left: 8.5 * s, top: 10.5 * s, width: 3 * s, height: 3 * s, borderRadius: 1.5 * s, backgroundColor: color }} />
      {/* Flash */}
      <View style={{ position: 'absolute', left: 7 * s, top: 2 * s, width: 6 * s, height: 3 * s, borderRadius: 1 * s, borderWidth: 1.5 * s, borderColor: color, borderBottomWidth: 0 }} />
    </View>
  )
}

export function IconGallery({ size = 20, color = '#2D3A8C' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size }}>
      {/* Frame */}
      <View style={{ position: 'absolute', left: 1 * s, top: 2 * s, width: 18 * s, height: 16 * s, borderRadius: 2 * s, borderWidth: 1.5 * s, borderColor: color }} />
      {/* Mountain */}
      <View style={{ position: 'absolute', left: 3 * s, top: 12 * s, width: 0, height: 0, borderLeftWidth: 5 * s, borderRightWidth: 5 * s, borderBottomWidth: 6 * s, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      <View style={{ position: 'absolute', left: 9 * s, top: 9 * s, width: 0, height: 0, borderLeftWidth: 4 * s, borderRightWidth: 4 * s, borderBottomWidth: 5 * s, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      {/* Sun */}
      <View style={{ position: 'absolute', left: 13 * s, top: 5 * s, width: 3 * s, height: 3 * s, borderRadius: 1.5 * s, backgroundColor: color }} />
    </View>
  )
}

export function IconPhoto({ size = 20, color = '#2D3A8C' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: 2 * s, top: 2 * s, width: 16 * s, height: 16 * s, borderRadius: 2 * s, borderWidth: 1.5 * s, borderColor: color }} />
      <View style={{ position: 'absolute', left: 5 * s, top: 11 * s, width: 0, height: 0, borderLeftWidth: 4 * s, borderRightWidth: 4 * s, borderBottomWidth: 5 * s, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      <View style={{ position: 'absolute', left: 10 * s, top: 6 * s, width: 3 * s, height: 3 * s, borderRadius: 1.5 * s, backgroundColor: color }} />
    </View>
  )
}

export function IconBack({ size = 20, color = '#2D3A8C' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 10 * s, height: 2 * s, backgroundColor: color, borderRadius: 1 * s, position: 'absolute', transform: [{ rotate: '45deg' }] }} />
      <View style={{ width: 10 * s, height: 2 * s, backgroundColor: color, borderRadius: 1 * s, position: 'absolute', transform: [{ rotate: '-45deg' }] }} />
    </View>
  )
}

export function IconForward({ size = 20, color = '#2D3A8C' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 10 * s, height: 2 * s, backgroundColor: color, borderRadius: 1 * s, position: 'absolute', transform: [{ rotate: '45deg' }] }} />
      <View style={{ width: 10 * s, height: 2 * s, backgroundColor: color, borderRadius: 1 * s, position: 'absolute', transform: [{ rotate: '-45deg' }] }} />
    </View>
  )
}

export function IconWarning({ size = 20, color = '#DC2626' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size }}>
      {/* Triangle */}
      <View style={{ position: 'absolute', left: 2 * s, top: 2 * s, width: 0, height: 0, borderLeftWidth: 8 * s, borderRightWidth: 8 * s, borderBottomWidth: 14 * s, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      {/* Exclamation */}
      <View style={{ position: 'absolute', left: 9 * s, top: 5 * s, width: 2 * s, height: 5 * s, backgroundColor: 'white', borderRadius: 1 * s }} />
      <View style={{ position: 'absolute', left: 9 * s, top: 12 * s, width: 2 * s, height: 2 * s, borderRadius: 1 * s, backgroundColor: 'white' }} />
    </View>
  )
}

export function IconIncident({ size = 20, color = '#DC2626' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size }}>
      {/* Shield */}
      <View style={{ position: 'absolute', left: 3 * s, top: 1 * s, width: 14 * s, height: 16 * s, borderRadius: 3 * s, borderWidth: 2 * s, borderColor: color }} />
      {/* Exclamation */}
      <View style={{ position: 'absolute', left: 9 * s, top: 5 * s, width: 2 * s, height: 5 * s, backgroundColor: color, borderRadius: 1 * s }} />
      <View style={{ position: 'absolute', left: 9 * s, top: 12 * s, width: 2 * s, height: 2 * s, borderRadius: 1 * s, backgroundColor: color }} />
    </View>
  )
}

// ─── Misc Icons ──────────────────────────────────────────────

export function IconProfile({ size = 20, color = '#2D3A8C' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size }}>
      {/* Head */}
      <View style={{ position: 'absolute', left: 6 * s, top: 1 * s, width: 8 * s, height: 8 * s, borderRadius: 4 * s, borderWidth: 1.5 * s, borderColor: color }} />
      {/* Body */}
      <View style={{ position: 'absolute', left: 2 * s, top: 11 * s, width: 16 * s, height: 8 * s, borderRadius: 8 * s, borderWidth: 1.5 * s, borderColor: color, borderBottomWidth: 0 }} />
    </View>
  )
}

export function IconSyncSmall({ size = 14, color = '#16A34A' }: IconProps) {
  const s = size / 14
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: 10 * s, height: 10 * s, borderRadius: 5 * s, borderWidth: 1.5 * s, borderColor: color, top: 2 * s, left: 2 * s, position: 'absolute' }} />
      <View style={{ position: 'absolute', left: 5 * s, top: 0, width: 4 * s, height: 3 * s, backgroundColor: color, borderRadius: 1.5 * s }} />
    </View>
  )
}

export function IconNavigate({ size = 20, color = '#1E3A5F' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size }}>
      {/* Arrow body */}
      <View style={{ position: 'absolute', left: 9 * s, top: 2 * s, width: 2 * s, height: 12 * s, backgroundColor: color, borderRadius: 1 * s }} />
      {/* Arrow head */}
      <View style={{ position: 'absolute', left: 3 * s, top: 10 * s, width: 0, height: 0, borderLeftWidth: 7 * s, borderRightWidth: 7 * s, borderBottomWidth: 8 * s, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
    </View>
  )
}

export function IconMapPin({ size = 20, color = '#1E3A5F' }: IconProps) {
  const s = size / 20
  return (
    <View style={{ width: size, height: size }}>
      {/* Pin head */}
      <View style={{ position: 'absolute', left: 4 * s, top: 0, width: 12 * s, height: 12 * s, borderRadius: 6 * s, borderWidth: 2 * s, borderColor: color }} />
      {/* Pin point */}
      <View style={{ position: 'absolute', left: 8.5 * s, top: 11 * s, width: 3 * s, height: 4 * s, backgroundColor: color, borderRadius: 1 * s }} />
    </View>
  )
}

export function IconOffline({ size = 14, color = '#F59E0B' }: IconProps) {
  const s = size / 14
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: 12 * s, height: 12 * s, borderRadius: 6 * s, borderWidth: 1.5 * s, borderColor: color, top: 1 * s, left: 1 * s, position: 'absolute' }} />
      <View style={{ position: 'absolute', left: 4 * s, top: 6 * s, width: 6 * s, height: 1.5 * s, backgroundColor: color, borderRadius: 1 * s }} />
    </View>
  )
}
