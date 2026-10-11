import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prepareScrollAnimations } from './scrollSync'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export interface RevealOptions {
  /** Selector for the animated elements within the root. Default `[data-reveal]`. */
  selector?: string
  /** Base px rise distance. Default 28. */
  y?: number
}

/**
 * Scroll-triggered reveal for marketing page sections.
 *
 * Attach the returned ref to the page's outermost layout Box and mark any
 * element `data-reveal`. Group siblings (e.g. the cards inside one section)
 * by wrapping them in a `data-reveal-group` container, or they group by their
 * parent element automatically. Each group plays once when it enters the
 * viewport, and every tween/trigger is killed on unmount.
 *
 * When the Lenis smooth-scroll bridge is active, ScrollTrigger is refreshed on
 * each of Lenis's eased scroll frames so reveals stay aligned with the visual
 * scroll position; without Lenis, ScrollTrigger falls back to its native
 * scroll listener.
 */
export function useScrollReveal<Root extends Element = HTMLDivElement>(
  options: RevealOptions = {},
) {
  const { selector = '[data-reveal]', y = 28 } = options
  const ref = useRef<Root | null>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    if (prefersReducedMotion()) return

    const prepare = prepareScrollAnimations()

    const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector))
    if (nodes.length === 0) return

    // Group nodes by their nearest group ancestor so grid siblings reveal
    // together rather than one-by-one.
    const sections = new Map<Element, HTMLElement[]>()
    for (const node of nodes) {
      const section = node.closest<HTMLElement>('[data-reveal-group]') ?? node.parentElement ?? root
      const bucket = sections.get(section)
      if (bucket) bucket.push(node)
      else sections.set(section, [node])
    }

    const ctx = gsap.context(() => {
      for (const [, group] of sections) {
        const targets = group.map((el) => ({
          el,
          delay: Number(el.dataset.revealDelay ?? 0),
        }))
        gsap.set(targets.map((t) => t.el), { opacity: 0, y })
        ScrollTrigger.create({
          trigger: group[0].parentElement ?? group[0],
          start: 'top 82%',
          once: true,
          onEnter: () => {
            for (const { el, delay } of targets) {
              gsap.to(el, {
                opacity: 1,
                y: 0,
                duration: 0.7,
                delay,
                ease: 'power2.out',
                overwrite: 'auto',
                clearProps: 'transform,opacity',
              })
            }
          },
        })
      }
    }, root)

    return () => {
      prepare()
      ctx.revert()
    }
  }, [selector, y])


  return ref
}
