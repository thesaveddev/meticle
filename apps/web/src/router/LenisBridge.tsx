import { useEffect } from 'react'
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

/** The synchronous hint AuthGuard itself reads: a cached user, or none. */
function hasCachedUser() {
  try {
    return Boolean(localStorage.getItem('user'))
  } catch {
    return false
  }
}

/**
 * Lenis smooth-scrolls the marketing site only — never the product.
 *
 * A stopped Lenis is not an idle Lenis: its window-level wheel listener keeps
 * preventDefault()ing every wheel/trackpad gesture, so `stop()` on app routes
 * did not hand scrolling back to the browser, it killed scrolling outright
 * across the whole signed-in application (only subtrees explicitly marked
 * `data-lenis-prevent` kept working). The bridge therefore destroys the
 * instance off public paths — no listeners, no animation frames — and creates
 * a fresh one when a public path is entered.
 *
 * `/compliance` serves the in-app hub when signed in, so a cached user keeps
 * that one path on native scroll too: Lenis would hijack wheel gestures over
 * the hub's inner scroll regions (tables, tab panels). Every other public
 * path still smooth-scrolls for signed-in visitors reading marketing pages;
 * a stale cached user merely degrades those to native scroll, which scrolls.
 */
function wantsLenis(pathname: string) {
  if (!isPublicPath(pathname)) return false
  if (pathname === '/compliance' && hasCachedUser()) return false
  return true
}

export default function LenisBridge() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    let lenis: Lenis | null = null

    const create = () => {
      const next = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        respectReducedMotion: false,
        // Lenis must own its animation frame. Without autoRaf (and no manual
        // lenis.raf(time) loop — the raf loop below only polls the route),
        // Lenis still preventDefault()s every wheel gesture but never animates
        // the scroll, so two-finger/trackpad scrolling is completely dead on
        // the public site.
        autoRaf: true,
      })
      lenis = next
      setLenisInstance(next)
      next.start()
      document.documentElement.dataset.lenisEnabled = 'true'
    }

    const teardown = () => {
      // destroy() removes the window wheel listener entirely — unlike stop(),
      // which keeps swallowing gestures. This is what hands scrolling back.
      lenis?.destroy()
      lenis = null
      setLenisInstance(null)
      delete document.documentElement.dataset.lenisEnabled
    }

    if (wantsLenis(window.location.pathname)) create()

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
    let lastWant = wantsLenis(lastPath)

    let rafId = 0

    const sync = () => {
      const pathname = window.location.pathname
      if (pathname !== lastPath) {
        lastPath = pathname
        const next = wantsLenis(pathname)
        if (next && !lastWant) create()
        else if (!next && lastWant) teardown()
        lastWant = next
      }
      setPrevent()
      rafId = requestAnimationFrame(sync)
    }

    rafId = requestAnimationFrame(sync)

    return () => {
      cancelAnimationFrame(rafId)
      muiObserver.disconnect()
      teardown()
      delete document.documentElement.dataset.lenisPrevent
    }
  }, [])

  return null
}
