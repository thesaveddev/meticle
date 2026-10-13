import { useEffect, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Does the user want motion kept to a minimum?
 *
 * The orb reads this itself rather than through the animation library it no
 * longer uses, which also means the orb's reduced-motion behaviour is one CSS
 * rule (`[data-mica-motion='reduced']`) instead of a branch inside every
 * animation. The media query is read during the first render, so the orb is
 * never drawn mid-breath for a user who asked for stillness, and the change
 * listener means toggling the OS setting takes effect without a reload.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(REDUCED_MOTION_QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return reduced
}

/**
 * Is the page the user is actually looking at?
 *
 * The orb's idle breath, its orbit and its glow are infinite animations, and an
 * infinite animation that nobody can see is pure cost: a backgrounded tab, or a
 * second window in front of this one, still asks the compositor for frames.
 * Everything the orb animates is therefore keyed off this flag — see
 * `mica-orb.css`, where `[data-mica-paused='true']` stops the animations at the
 * animation layer rather than at the React layer, so pausing costs no render.
 *
 * `prefers-reduced-motion` is read by `usePrefersReducedMotion` above rather
 * than here, because the two flags end up in different places: that one has to
 * reach the amplitude subscription as well as the stylesheet (a user who asked
 * for stillness should not have a meter scaling the orb either), while this one
 * only ever becomes an attribute the CSS pauses on.
 */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  )

  useEffect(() => {
    if (typeof document === 'undefined') return
    const sync = () => setVisible(document.visibilityState !== 'hidden')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  return visible
}
