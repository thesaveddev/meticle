import React from 'react'
import { View, Text } from 'react-native'
import { useAppColors } from '../theme'

/** Google Maps logo — multicolored pin with map grid */
export function GoogleMapsLogo({ size = 40 }: { size?: number }) {
  const s = size
  const pinH = s * 0.55
  const pinW = s * 0.38
  const headR = s * 0.22
  const c = useAppColors()
  const isDark = c.bg === '#0F172A'

  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Map grid background */}
      <View style={{
        width: s * 0.7, height: s * 0.7,
        borderRadius: s * 0.14,
        backgroundColor: isDark ? '#1A3A2A' : '#E8F5E9',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Grid lines */}
        <View style={{ position: 'absolute', top: '35%', left: 0, right: 0, height: 1, backgroundColor: '#A5D6A7' }} />
        <View style={{ position: 'absolute', top: '65%', left: 0, right: 0, height: 1, backgroundColor: '#A5D6A7' }} />
        <View style={{ position: 'absolute', left: '35%', top: 0, bottom: 0, width: 1, backgroundColor: '#A5D6A7' }} />
        <View style={{ position: 'absolute', left: '65%', top: 0, bottom: 0, width: 1, backgroundColor: '#A5D6A7' }} />
        {/* Pin */}
        <View style={{
          width: pinW, height: pinH,
          backgroundColor: '#EA4335',
          borderRadius: pinW / 2,
          borderBottomLeftRadius: pinW * 0.1,
          borderBottomRightRadius: pinW * 0.1,
          alignItems: 'center',
          paddingTop: pinH * 0.08,
        }}>
          <View style={{
            width: headR * 1.6, height: headR * 1.6,
            borderRadius: headR * 0.8,
            backgroundColor: '#FFFFFF',
          }} />
        </View>
      </View>
    </View>
  )
}

/** Apple Maps logo — gradient pin on blue-white grid */
export function AppleMapsLogo({ size = 40 }: { size?: number }) {
  const s = size
  const pinW = s * 0.28
  const c = useAppColors()
  const isDark = c.bg === '#0F172A'

  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: s * 0.7, height: s * 0.7,
        borderRadius: s * 0.14,
        backgroundColor: isDark ? '#1A2A3A' : '#E3F2FD',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Road grid */}
        <View style={{ position: 'absolute', top: '40%', left: 0, right: 0, height: 2, backgroundColor: '#FFFFFF' }} />
        <View style={{ position: 'absolute', top: '60%', left: 0, right: 0, height: 1.5, backgroundColor: '#BBDEFB' }} />
        <View style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 2, backgroundColor: '#FFFFFF' }} />
        <View style={{ position: 'absolute', left: '60%', top: 0, bottom: 0, width: 1.5, backgroundColor: '#BBDEFB' }} />
        {/* Pin — red circle with point */}
        <View style={{
          width: pinW,
          alignItems: 'center',
        }}>
          <View style={{
            width: pinW, height: pinW,
            borderRadius: pinW / 2,
            backgroundColor: '#EA4335',
          }} />
          <View style={{
            width: 0, height: 0,
            borderLeftWidth: pinW * 0.4,
            borderRightWidth: pinW * 0.4,
            borderTopWidth: pinW * 0.6,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: '#EA4335',
            marginTop: -1,
          }} />
        </View>
      </View>
    </View>
  )
}

/** Waze logo — smiling speech bubble on blue background */
export function WazeLogo({ size = 40 }: { size?: number }) {
  const s = size
  const bubbleW = s * 0.58
  const bubbleH = s * 0.48
  const c = useAppColors()
  const isDark = c.bg === '#0F172A'

  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: s * 0.7, height: s * 0.7,
        borderRadius: s * 0.14,
        backgroundColor: isDark ? '#1A3A4A' : '#33CCFF',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Speech bubble */}
        <View style={{
          width: bubbleW, height: bubbleH,
          backgroundColor: '#FFFFFF',
          borderRadius: bubbleH / 2,
          alignItems: 'center', justifyContent: 'center',
          marginTop: -s * 0.04,
        }}>
          {/* Eyes */}
          <View style={{ flexDirection: 'row', gap: bubbleW * 0.12, marginBottom: 1 }}>
            <View style={{ width: bubbleW * 0.14, height: bubbleW * 0.18, borderRadius: bubbleW * 0.07, backgroundColor: '#333' }} />
            <View style={{ width: bubbleW * 0.14, height: bubbleW * 0.18, borderRadius: bubbleW * 0.07, backgroundColor: '#333' }} />
          </View>
          {/* Smile */}
          <View style={{
            width: bubbleW * 0.35,
            height: bubbleW * 0.18,
            borderBottomLeftRadius: bubbleW * 0.18,
            borderBottomRightRadius: bubbleW * 0.18,
            borderTopLeftRadius: bubbleW * 0.18,
            borderTopRightRadius: bubbleW * 0.18,
            backgroundColor: 'transparent',
            borderBottomColor: '#333',
            borderBottomWidth: 2,
            borderLeftWidth: 2,
            borderRightWidth: 2,
            borderTopWidth: 0,
            transform: [{ rotate: '180deg' }],
          }} />
        </View>
        {/* Bubble tail */}
        <View style={{
          width: 0, height: 0,
          borderLeftWidth: bubbleW * 0.12,
          borderRightWidth: bubbleW * 0.12,
          borderTopWidth: bubbleW * 0.2,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: '#FFFFFF',
          marginLeft: bubbleW * 0.25,
          marginTop: -2,
        }} />
      </View>
    </View>
  )
}

/** Fallback for unknown map apps */
export function FallbackMapLogo({ size = 40 }: { size?: number }) {
  const s = size
  const c = useAppColors()
  return (
    <View style={{
      width: s * 0.7, height: s * 0.7,
      borderRadius: s * 0.14,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: s * 0.28, fontWeight: '700', color: c.muted }}>?</Text>
    </View>
  )
}

/** Get the right logo component for a map app ID */
export function getMapLogo(appId: string, size = 40) {
  switch (appId) {
    case 'google': return <GoogleMapsLogo size={size} />
    case 'apple': return <AppleMapsLogo size={size} />
    case 'waze': return <WazeLogo size={size} />
    default: return <FallbackMapLogo size={size} />
  }
}
