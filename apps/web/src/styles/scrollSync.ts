import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { onLenisInstance } from '../router/lenisStore'

let registered = false

/**
 * Register the GSAP plugins once per page load and keep ScrollTrigger in
 * lockstep with the Lenis smooth-scroll bridge: every Lenis-eased scroll frame
 * refreshes ScrollTrigger, so triggers measure the visual scroll position
 * rather than raw wheel deltas. Without an active Lenis instance,
 * ScrollTrigger falls back to its own native scroll listener.
 */
export function prepareScrollAnimations(): () => void {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger)
    registered = true
  }

  const offs: Array<() => void> = []
  const unsubscribe = onLenisInstance((lenis) => {
    if (lenis) offs.push(lenis.on('scroll', ScrollTrigger.update))
  })

  return () => {
    unsubscribe()
    for (const off of offs) off()
  }
}
