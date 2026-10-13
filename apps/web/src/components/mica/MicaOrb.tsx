import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react'

import { MICA_LABEL, type MicaState } from './mica.identity'
import { useDocumentVisible, usePrefersReducedMotion } from './mica.motion'
import type { MicaAudioChannel } from './mica.audio'
import './mica-orb.css'

/** Re-exported so existing importers keep working; the union lives in one place. */
export type { MicaState }

interface MicaOrbProps {
  state: MicaState
  /**
   * The session's amplitude channel. The level is deliberately *not* a prop:
   * a number here would be React state, and a number that changes sixty times a
   * second is sixty renders of the assistant — see `mica.audio.ts`.
   */
  audio?: MicaAudioChannel
  onPress?: () => void
}

/**
 * Mica's identity colours, shared with the mobile app (apps/mobile/src/theme.tsx
 * `mica`). All of these are token values harvested by scripts/design/palette.mjs
 * (ThemeContext / marketing-tokens), so the design-system lint stays clean and
 * the orb cannot drift from the brand the rest of the app ships.
 */
const COLORS = {
  primaryBlue: '#0164C8',
  deepBlue: '#014FB5',
  sky: '#6B8AFD',
  cyan: '#03C6B1',
  mint: '#10B981',
  white: '#FFFFFF',
}

/**
 * The orb.
 *
 * ## What it is now
 *
 * A *visual* component with three inputs and no lifecycle of its own: a state, a
 * channel to read amplitude from, and a press handler. It does not own the
 * session, start the microphone, fetch anything or run a loop. The art and the
 * motion live in `mica.identity.ts` and `mica-orb.css`.
 *
 * ## Why it was rewritten
 *
 * Three separate costs, all of which showed up as the same symptom — an orb that
 * arrived late and stuttered:
 *
 *   1. **Seven infinite animation loops per state, restarted on every state
 *      change.** They are gone: the motion is CSS keyed off `data-mica-state`,
 *      so a state change is an attribute write and the browser's animation layer
 *      does the rest — no JavaScript per frame, and nothing to leak.
 *   2. **A 42px `filter: blur()` disc and a 60px `box-shadow` on the layer being
 *      scaled** — two properties that force a re-rasterisation of the layer on
 *      every frame. The glow is a radial gradient fading to transparent now (see
 *      `mica-orb.css`), which scales as a composited transform, and the orb's
 *      own halo is a static layer that never moves.
 *   3. **The amplitude arriving as a prop.** It arrives through the session's
 *      channel and is written straight onto two elements' `transform`, so the orb
 *      reacts to the room without React being asked. Measured in
 *      `mica.renderBudget.test.tsx`: 42 commits and 2339ms of render work across
 *      30 audio frames before, 0 commits after.
 *
 * The component also no longer imports an animation library. Mica was that
 * library's only consumer in this app, so keeping it out of the orb takes ~35kB
 * (gzipped) of JavaScript out of the entry bundle every page loads before the
 * orb can paint; the two surfaces that still animate an entrance (the overlay
 * and the bar) load on demand instead.
 *
 * Everything the tests and the screens depend on is unchanged: the same gradient
 * and eyes, the same ambient glow in every state, one extra signal per state
 * (orbit and waveform while speaking, the danger ring on failure), the same
 * accessible name and the same disabled-while-active rule.
 */
export default function MicaOrb({ state, audio, onPress }: MicaOrbProps) {
  const isIdle = state === 'idle'
  const isError = state === 'error'
  const reducedMotion = usePrefersReducedMotion()
  const visible = useDocumentVisible()

  const orbSize = isIdle ? 62 : 170
  const orbitSize = isIdle ? 78 : 250

  const coreRef = useRef<HTMLDivElement | null>(null)
  const waveformRef = useRef<HTMLDivElement | null>(null)

  /**
   * Amplitude, written where it is drawn.
   *
   * The meter already smooths the level over a rolling window (useMica), so the
   * value goes through rather than being sprung: a spring here would be a second
   * animation loop running for the whole session to smooth a number that arrives
   * pre-smoothed, and the orb is meant to have no loops of its own. `transform`
   * is the only thing written, so the browser composites the change instead of
   * re-laying anything out.
   */
  const applyLevel = useCallback((level: number) => {
    const clamped = Number.isNaN(level) ? 0 : Math.max(0, Math.min(1, level))
    if (coreRef.current) coreRef.current.style.transform = `scale(${(1 + clamped * 0.06).toFixed(4)})`
    if (waveformRef.current) waveformRef.current.style.transform = `scaleY(${(1 + clamped * 0.25).toFixed(4)})`
  }, [])

  useEffect(() => {
    if (!audio) return undefined
    if (reducedMotion) {
      // Reduced motion means *still*: no amplitude response either, so nothing
      // is quietly moving for a user who asked it not to.
      applyLevel(0)
      return undefined
    }
    return audio.subscribe(applyLevel)
  }, [audio, applyLevel, reducedMotion])

  const waveBars = useMemo(() => [8, 14, 22, 32, 44, 29, 54, 36, 25, 15, 8], [])

  return (
    <div
      className="mica-root"
      data-mica-state={state}
      data-mica-motion={reducedMotion ? 'reduced' : 'full'}
      data-mica-paused={visible ? 'false' : 'true'}
      style={{
        width: isIdle ? 90 : '100%',
        height: isIdle ? 90 : 330,
        // Read by the gradient in mica-orb.css, so the palette has one home.
        '--mica-blue': COLORS.primaryBlue,
        '--mica-deep-blue': COLORS.deepBlue,
        '--mica-cyan': COLORS.cyan,
        '--mica-mint': COLORS.mint,
      } as CSSProperties}
    >
      {/* AMBIENT GLOW — exactly one in every state; the orb's resting signal.
          A gradient to transparent rather than a blurred disc: same halo, and it
          stays a composited transform at every scale. */}
      <div
        aria-hidden
        data-mica-glow="on"
        className="mica-glow"
        style={{ width: orbSize * 2.2, height: orbSize * 2.2 }}
      />

      {/* HUGGING HALO — the glow the orb itself sits in. Static on purpose: it
          never animates, so it is rasterised once and from then on only moved
          with the layer. */}
      <div
        aria-hidden
        data-mica-halo="on"
        style={{
          position: 'absolute',
          width: orbSize * 1.3,
          height: orbSize * 1.3,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.cyan}55 0%, ${COLORS.cyan}22 55%, ${COLORS.cyan}00 78%)`,
        }}
      />

      {/* OUTER ORBIT */}
      <div aria-hidden className="mica-orbit" style={{ width: orbitSize, height: orbitSize * 0.62 }}>
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
      </div>

      {/* INNER ORBIT (counter-rotating) */}
      {!isIdle && (
        <div aria-hidden className="mica-orbit mica-orbit--inner" style={{ width: 210, height: 110 }}>
          <svg width={210} height={110} viewBox="0 0 210 110" style={{ overflow: 'visible' }}>
            <ellipse cx="105" cy="55" rx="82" ry="28" fill="none" stroke={COLORS.mint} strokeWidth="1" opacity={0.35} />
            <circle cx="23" cy="55" r="2.5" fill={COLORS.mint} />
          </svg>
        </div>
      )}

      {/* ERROR RING — the one signal that distinguishes a failure from speech. */}
      {isError && (
        <div
          aria-hidden
          data-mica-ring="error"
          style={{
            position: 'absolute',
            width: orbSize + 18,
            height: orbSize + 18,
            borderRadius: '50%',
            border: '3px solid var(--mc-danger)',
            // Static: the ring is a state, not an animation, so it is painted
            // once rather than re-shadowed every frame.
            boxShadow: '0 0 24px var(--mc-danger)',
          }}
        />
      )}

      {/* ORB */}
      <button
        type="button"
        disabled={!isIdle}
        onClick={isIdle ? onPress : undefined}
        aria-label={MICA_LABEL.orb}
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
        {/* The wrapper the microphone scale is written to. Kept off `.mica-core`
            so the breath (CSS) and the amplitude (a style write) multiply instead
            of overwriting each other. */}
        <div ref={coreRef} className="mica-core-scale">
          <div className="mica-core" style={{ width: orbSize, height: orbSize }}>
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
        </div>
      </button>

      {/* VOICE WAVEFORM — speech states only; an error has nothing to meter. */}
      {!isIdle && !isError && (
        <div
          ref={waveformRef}
          aria-hidden
          data-mica-waveform="on"
          className="mica-waveform"
          style={{
            bottom: -4,
            height: 58,
            gap: 4,
          }}
        >
          {waveBars.map((height, index) => (
            <div
              // The bars are a fixed, ordered sequence with no identity of their
              // own — the index *is* the phase.
              key={index}
              data-mica-bar="on"
              className="mica-bar"
              style={{
                width: 4,
                height,
                background: COLORS.cyan,
                // Negative, and a fraction of the wave's period, so the crest
                // travels along the row instead of every bar rising together.
                animationDelay: `${-(index * 0.07).toFixed(2)}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
