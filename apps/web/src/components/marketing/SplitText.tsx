/**
 * React Bits `SplitText`, ported for this codebase.
 *
 * Upstream: https://reactbits.dev/text-animations/SplitText
 *
 * Differences from the upstream JSX:
 * - TypeScript; plain effect instead of `@gsap/react` (same lifecycle, one
 *   less dependency).
 * - Word-level split by default: a per-char cascade on a long
 *   care-operations headline reads as a typographic gimmick and drags mid-word
 *   legibility; a word cascade keeps the copy readable during the animation.
 * - Entrance variant: the hero headline animates on page load rather than on
 *   scroll (upstream's ScrollTrigger start logic is kept for the scroll case,
 *   and plays immediately when the element is already in view).
 * - Reduced motion is respected: the text renders whole, no split, no tween.
 * - Waits for web fonts (`document.fonts.ready`) so the split measures real
 *   glyphs instead of the fallback face.
 * - ScrollTrigger refreshes are wired to the Lenis smooth-scroll bridge via
 *   the shared `prepareScrollAnimations()` helper, and a `style` prop is
 *   accepted so the page's own design tokens (MUI `sx` objects) can style the
 *   rendered heading directly.
 */
import { useEffect, useRef, useState, type CSSProperties, type ElementType } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText as GSAPSplitText } from 'gsap/SplitText'
import { prepareScrollAnimations } from '../../styles/scrollSync'

gsap.registerPlugin(ScrollTrigger, GSAPSplitText)

export interface SplitTextProps {
  text: string
  className?: string
  /** Inline styles forwarded to the rendered element (design tokens). */
  style?: CSSProperties
  /** Stagger between words, in ms. Upstream default 50. */
  delay?: number
  /** Per-word tween duration, in seconds. Upstream default 1.25. */
  duration?: number
  ease?: string
  splitType?: 'words' | 'chars' | 'words,chars' | 'lines'
  from?: gsap.TweenVars
  to?: gsap.TweenVars
  /**
   * 0–1 fraction of the element's height that must be visible before the
   * animation starts (scroll mode only). Upstream default 0.1.
   */
  threshold?: number
  rootMargin?: string
  /**
   * 'load' plays the cascade as soon as the component mounts and fonts are
   * ready (the hero case — above the fold, a scroll trigger would only add a
   * failure mode); 'scroll' keeps upstream's ScrollTrigger behaviour.
   */
  mode?: 'load' | 'scroll'
  /** Heading level; defaults to `h1` (upstream defaults to a paragraph). */
  tag?: ElementType
}

export default function SplitText({
  text,
  className = '',
  style,
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'words',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  mode = 'load',
  tag = 'h1',
}: SplitTextProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [fontsReady, setFontsReady] = useState(
    typeof document !== 'undefined' && document.fonts?.status === 'loaded',
  )
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (fontsReady || typeof document === 'undefined' || !document.fonts) return
    let cancelled = false
    document.fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [fontsReady])

  useEffect(() => {
    const el = ref.current
    if (!el || !text || !fontsReady) return

    // Reduced motion: render the headline whole, nothing split, nothing moving.
    if (reducedMotion) return

    const unbindLenis = prepareScrollAnimations()

    // Start line derived from upstream's threshold/rootMargin maths.
    const startPct = (1 - threshold) * 100
    const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin)
    const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0
    const marginUnit = marginMatch ? (marginMatch[2] || 'px') : 'px'
    const sign =
      marginValue === 0
        ? ''
        : marginValue < 0
          ? `-=${Math.abs(marginValue)}${marginUnit}`
          : `+=${marginValue}${marginUnit}`
    const start = `top ${startPct}%${sign}`

    const instance = new GSAPSplitText(el, {
      type: splitType,
      smartWrap: true,
      autoSplit: splitType === 'lines',
      linesClass: 'split-line',
      wordsClass: 'split-word',
      charsClass: 'split-char',
      reduceWhiteSpace: false,
      aria: 'auto',
      onSplit: (self) => {
        let targets: Element[] = []
        const pick = (list?: readonly Element[]) => {
          if (list && list.length) targets = [...list]
        }
        if (splitType.includes('chars')) pick(self.chars)
        if (!targets.length && splitType.includes('words')) pick(self.words)
        if (!targets.length && splitType.includes('lines')) pick(self.lines)
        if (!targets.length) pick(self.chars ?? self.words ?? self.lines)

        const vars: gsap.TweenVars = {
          ...to,
          duration,
          ease,
          stagger: delay / 1000,
          willChange: 'transform, opacity',
          force3D: true,
        }

        if (mode === 'scroll') {
          // Upstream behaviour: enter on scroll. For an above-the-fold hero
          // this is fragile — ScrollTrigger's initial refresh can race the
          // split — so it stays opt-in for mid-page headings.
          vars.scrollTrigger = {
            trigger: el,
            start,
            once: true,
            fastScrollEnd: true,
            anticipatePin: 0.4,
          }
          return gsap.fromTo(targets, { ...from }, vars)
        }

        // Load mode: fromTo plays on creation — the split DOM has just been
        // inserted, so the from-state paints on the same frame and the
        // cascade runs deterministically (no paused/delayedCall handoff,
        // which races React StrictMode's unmount cleanup).
        return gsap.fromTo(targets, { ...from }, vars)
      },
    })

    return () => {
      const st = ScrollTrigger.getAll().find((s) => s.trigger === el)
      if (st) st.kill()
      try {
        instance.revert()
      } catch {
        /* SplitText throws if the DOM was already reset — safe to ignore */
      }
      unbindLenis()
    }
  }, [text, delay, duration, ease, splitType, threshold, rootMargin, mode, fontsReady, reducedMotion, from, to])

  const Tag = tag as ElementType
  return (
    <Tag
      ref={ref}
      className={`split-parent ${className}`}
      style={{ whiteSpace: 'normal', wordWrap: 'break-word', ...style }}
    >
      {text}
    </Tag>
  )
}
