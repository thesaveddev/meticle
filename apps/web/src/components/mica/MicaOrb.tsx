import { useEffect, useMemo } from 'react'
import { motion, useMotionValue, useSpring, useTransform, animate, type MotionValue } from 'framer-motion'

export type MicaState = 'idle' | 'listening' | 'thinking' | 'responding'

interface MicaOrbProps {
  state: MicaState
  /** 0 → 1 microphone / TTS amplitude. Drives scale + waveform energy. */
  audioLevel?: number
  onPress?: () => void
}

/**
 * Mica's identity colours, shared with the mobile app (apps/mobile/src/theme.tsx
 * `mica`). All of these are token values harvested by scripts/design/palette.mjs
 * (ThemeContext / marketing-tokens), so the design-system lint stays clean and
 * the orb cannot drift from the brand the rest of the app ships.
 */
const COLORS = {
  primaryBlue: '#2F80ED',
  deepBlue: '#1F68C7',
  sky: '#6B8AFD',
  cyan: '#10BFA5',
  mint: '#10B981',
  white: '#FFFFFF',
}

export default function MicaOrb({ state, audioLevel = 0, onPress }: MicaOrbProps) {
  const isIdle = state === 'idle'

  const orbSize = isIdle ? 62 : 170
  const orbitSize = isIdle ? 78 : 250

  // Smoothed audio level (spring) — mirrors the mobile audio useSharedValue.
  const audioRaw = useMotionValue(0)
  const audio = useSpring(audioRaw, { damping: 18, stiffness: 180 })
  useEffect(() => {
    audioRaw.set(Math.max(0, Math.min(1, audioLevel)))
  }, [audioLevel, audioRaw])

  // Orb scale driven by state (restarted on state change).
  const scale: MotionValue<number> = useMotionValue(1)
  const glowOpacity: MotionValue<number> = useMotionValue(0.28)
  const glowScale: MotionValue<number> = useMotionValue(1)
  const rotation: MotionValue<number> = useMotionValue(0)
  const innerRotation: MotionValue<number> = useMotionValue(0)
  const waveScale: MotionValue<number> = useMotionValue(1)
  const barPhase: MotionValue<number> = useMotionValue(0)

  useEffect(() => {
    const controls = [] as ReturnType<typeof animate>[]
    // Reset base values on state transition (same intent as mobile reset).
    controls.push(animate(scale, 1, { duration: 0.25 }))
    controls.push(animate(glowOpacity, isIdle ? 0.28 : 0.55, { duration: 0.3 }))

    if (state === 'idle') {
      // Extremely subtle breathing — barely alive.
      controls.push(animate(scale, [1, 1.025, 1], { duration: 4.8, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(glowOpacity, [0.38, 0.22, 0.38], { duration: 5.2, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(glowScale, [1, 1.04, 1], { duration: 5.2, ease: 'easeInOut', repeat: Infinity }))
      // Very slow orbital movement.
      controls.push(animate(rotation, [0, 360], { duration: 18, ease: 'linear', repeat: Infinity }))
    } else if (state === 'listening') {
      controls.push(animate(scale, [1, 1.055, 1], { duration: 1.8, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(glowOpacity, [0.8, 0.45, 0.8], { duration: 1.8, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(glowScale, [1, 1.12, 1], { duration: 1.8, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(rotation, [0, 360], { duration: 6.5, ease: 'linear', repeat: Infinity }))
      controls.push(animate(innerRotation, [0, -360], { duration: 8.5, ease: 'linear', repeat: Infinity }))
      controls.push(animate(waveScale, [1, 1.15, 0.9, 1], { duration: 1, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(barPhase, [0, 1], { duration: 0.7, ease: 'linear', repeat: Infinity }))
    } else if (state === 'thinking') {
      // Between "stops speaking" and "AI responds": contained, purposeful energy.
      controls.push(animate(scale, [1, 1.04, 1], { duration: 1.1, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(glowOpacity, [0.7, 0.5, 0.7], { duration: 1.1, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(glowScale, [1, 1.09, 1], { duration: 1.1, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(rotation, [0, 360], { duration: 4.5, ease: 'linear', repeat: Infinity }))
      controls.push(animate(innerRotation, [0, -360], { duration: 6, ease: 'linear', repeat: Infinity }))
      controls.push(animate(barPhase, [0, 1], { duration: 1, ease: 'linear', repeat: Infinity }))
    } else if (state === 'responding') {
      // Calmer than listening; the orb is speaking.
      controls.push(animate(scale, [1, 1.045, 1], { duration: 1.4, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(glowOpacity, [0.7, 0.4, 0.7], { duration: 1.4, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(glowScale, [1, 1.08, 1], { duration: 1.4, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(rotation, [0, 360], { duration: 10, ease: 'linear', repeat: Infinity }))
      controls.push(animate(innerRotation, [0, -360], { duration: 13, ease: 'linear', repeat: Infinity }))
      controls.push(animate(waveScale, [1, 1.1, 0.92, 1], { duration: 1.3, ease: 'easeInOut', repeat: Infinity }))
      controls.push(animate(barPhase, [0, 1], { duration: 0.9, ease: 'linear', repeat: Infinity }))
    }
    return () => controls.forEach(c => c.stop())
  }, [state])

  const audioScale = useTransform(audio, [0, 1], [1, 1.06])
  const orbStyle = useTransform<number, number>([scale, audioScale], ([s, a]) => s * a)
  const audioWave = useTransform(audio, [0, 1], [0.9, 1.25])
  const waveformStyle = useTransform<number, number>([waveScale, audioWave], ([w, a]) => w * a)

  const waveBars = useMemo(() => [8, 14, 22, 32, 44, 29, 54, 36, 25, 15, 8], [])

  return (
    <div
      style={{
        width: isIdle ? 90 : '100%',
        height: isIdle ? 90 : 330,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* AMBIENT GLOW */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          width: orbSize * 1.65,
          height: orbSize * 1.65,
          borderRadius: orbSize,
          background: COLORS.cyan,
          filter: `blur(${isIdle ? 18 : 42}px)`,
          boxShadow: `0 0 ${isIdle ? 30 : 60}px ${COLORS.cyan}`,
          opacity: glowOpacity,
          scale: glowScale,
        }}
      />

      {/* OUTER ORBIT */}
      <motion.div aria-hidden style={{ position: 'absolute', rotate: rotation }}>
        <svg width={orbitSize} height={orbitSize * 0.62} viewBox="0 0 250 155" style={{ overflow: 'visible' }}>
          <ellipse
            cx="125"
            cy="77"
            rx={isIdle ? 36 : 108}
            ry={isIdle ? 19 : 108}
            fill="none"
            stroke={COLORS.sky}
            strokeWidth={isIdle ? 1 : 1.5}
            opacity={isIdle ? 0.35 : 0.6}
          />
          {!isIdle && (
            <>
              <circle cx="18" cy="77" r="3" fill={COLORS.cyan} />
              <circle cx="232" cy="77" r="3" fill={COLORS.mint} />
            </>
          )}
        </svg>
      </motion.div>

      {/* INNER ORBIT (counter-rotating) */}
      {!isIdle && (
        <motion.div aria-hidden style={{ position: 'absolute', rotate: innerRotation }}>
          <svg width={210} height={110} viewBox="0 0 210 110" style={{ overflow: 'visible' }}>
            <ellipse cx="105" cy="55" rx="82" ry="28" fill="none" stroke={COLORS.mint} strokeWidth="1" opacity={0.35} />
            <circle cx="23" cy="55" r="2.5" fill={COLORS.mint} />
          </svg>
        </motion.div>
      )}

      {/* ORB */}
      <button
        type="button"
        disabled={!isIdle}
        onClick={isIdle ? onPress : undefined}
        aria-label="MICA AI assistant"
        style={{
          width: orbSize,
          height: orbSize,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: isIdle ? 'pointer' : 'default',
          zIndex: 1,
        }}
      >
        <motion.div
          style={{
            width: orbSize,
            height: orbSize,
            borderRadius: orbSize / 2,
            overflow: 'hidden',
            scale: orbStyle,
            boxShadow: `0 0 ${isIdle ? 18 : 32}px ${COLORS.cyan}cc`,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 'inherit',
              background: `linear-gradient(135deg, ${COLORS.deepBlue} 0%, ${COLORS.primaryBlue} 38%, ${COLORS.cyan} 72%, ${COLORS.mint} 100%)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* GLASS HIGHLIGHT */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '7%',
                left: '10%',
                width: orbSize * 0.62,
                height: orbSize * 0.62,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.13)',
              }}
            />
            {/* MICA EYES */}
            <div
              aria-hidden
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: isIdle ? 12 : 28,
                marginTop: isIdle ? 2 : 0,
              }}
            >
              <div style={{ width: isIdle ? 5 : 11, height: isIdle ? 17 : 38, borderRadius: 20, background: COLORS.white }} />
              <div style={{ width: isIdle ? 5 : 11, height: isIdle ? 17 : 38, borderRadius: 20, background: COLORS.white }} />
            </div>
            {/* INNER ENERGY WAVE */}
            {!isIdle && (
              <svg width={135} height={70} aria-hidden style={{ position: 'absolute', bottom: 20, left: 17 }}>
                <path d="M5 45 C25 15 42 65 63 37 C84 8 105 57 130 20" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </motion.div>
      </button>

      {/* VOICE WAVEFORM */}
      {!isIdle && (
        <motion.div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: -4,
            height: 58,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            scaleY: waveformStyle,
          }}
        >
          {waveBars.map((height, index) => (
            <WaveBar key={index} baseHeight={height} tall={index % 2 === 0} phase={barPhase} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

/** One waveform bar. The phase MotionValue scrolls a pseudo-wave per bar. */
function WaveBar({ baseHeight, tall, phase }: { baseHeight: number; tall: boolean; phase: MotionValue<number> }) {
  const scaleYTarget = useTransform(phase, [0, 1], [1, 1])
  const height = baseHeight * (tall ? 0.8 : 1)
  return (
    <motion.div
      style={{
        width: 4,
        height,
        borderRadius: 5,
        background: COLORS.cyan,
        scaleY: scaleYTarget,
        transformOrigin: 'center',
      }}
    />
  )
}
