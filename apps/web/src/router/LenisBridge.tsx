import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { setLenisInstance } from './lenisStore'

const PUBLIC_PATH_PREFIXES = [
  '/platform',
  '/compliance',
  '/solutions',
  '/features',
  '/security',
  '/mobile',
  '/app',
  '/download',
  '/how-it-works',
  '/pricing',
  '/about',
  '/case-studies',
  '/contact',
  '/blog',
  '/compliance-badges',
  '/survey',
  '/family-portal',
  '/invoice',
  '/learn',
  '/privacy',
  '/terms',
  '/cookies',
  '/delete-account',
  '/portal',
]

const EXACT_PUBLIC_PATHS = new Set([
  '/',
  '/platform',
  '/compliance',
  '/security',
  '/mobile',
  '/app',
  '/download',
  '/how-it-works',
  '/pricing',
  '/about',
  '/case-studies',
  '/contact',
  '/blog',
  '/compliance-badges',
  '/learn',
  '/privacy',
  '/terms',
  '/cookies',
  '/delete-account',
  '/portal/login',
  '/portal/dashboard',
])

function isPublicPath(pathname: string) {
  if (EXACT_PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p + '/') || pathname.startsWith(p + '?'))
}

const muiPanelSelectors = [
  '.MuiDrawer-root',
  '.MuiDialog-root',
  '.MuiMenu-root .MuiMenu-paper',
  '.MuiPopover-root .MuiPopover-paper',
  '.MuiPickersModalPaper-root',
  '.MuiPickersDay-root',
  '[class*="MuiDatePicker"]',
  '[class*="MuiMobileDateTimePicker"]',
  '[class*="MuiDesktopDatePicker"]',
]

function hasOpenMuiPanel() {
  if (typeof document === 'undefined') return false
  return muiPanelSelectors.some((sel) => document.querySelector(sel))
}

export default function LenisBridge() {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      respectReducedMotion: false,
      // Lenis must own its animation frame. Without autoRaf (and no manual
      // lenis.raf(time) loop — the raf loop below only polls the route), Lenis
      // still preventDefault()s every wheel gesture but never animates the
      // scroll, so two-finger/trackpad scrolling is completely dead on the
      // public site.
      autoRaf: true,
    })

    lenisRef.current = lenis
    setLenisInstance(lenis)

    let enabled = isPublicPath(window.location.pathname)

    if (enabled) {
      lenis.start()
      document.documentElement.dataset.lenisEnabled = 'true'
    }

    const setPrevent = () => {
      if (hasOpenMuiPanel()) {
        document.documentElement.dataset.lenisPrevent = 'true'
      } else {
        document.documentElement.removeAttribute('data-lenis-prevent')
      }
    }

    setPrevent()
    const muiObserver = new MutationObserver(setPrevent)
    muiObserver.observe(document.body, { childList: true, subtree: true })

    let lastPath = window.location.pathname

    let rafId = 0

    const sync = () => {
      const pathname = window.location.pathname
      if (pathname !== lastPath) {
        lastPath = pathname
        const next = isPublicPath(pathname)
        if (next && !enabled) {
          lenis.start()
          document.documentElement.dataset.lenisEnabled = 'true'
        } else if (!next && enabled) {
          lenis.stop()
          document.documentElement.dataset.lenisEnabled = ''
        }
        enabled = next
      }
      setPrevent()
      rafId = requestAnimationFrame(sync)
    }

    rafId = requestAnimationFrame(sync)

    return () => {
      cancelAnimationFrame(rafId)
      muiObserver.disconnect()
      lenis.stop()
      setLenisInstance(null)
      document.documentElement.dataset.lenisEnabled = ''
      document.documentElement.dataset.lenisPrevent = ''
      delete document.documentElement.dataset.lenisEnabled
      delete document.documentElement.dataset.lenisPrevent
      lenisRef.current = null
    }
  }, [])

  return null
}
