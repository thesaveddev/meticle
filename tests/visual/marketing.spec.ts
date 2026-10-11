import { test, expect } from '@playwright/test'

/**
 * Marketing-surface visual regression.
 *
 * Scope is deliberately the routes that render without authentication and
 * without meaningful API state. The authenticated app has 114 routes full of
 * live data; screenshotting those would produce a diff on every test-data
 * change and train everyone to ignore red screenshots. A harness nobody trusts
 * is worse than no harness, because it reads as coverage that isn't there.
 *
 * Add a route here when a layout is worth protecting. Do not add routes whose
 * content changes per deploy.
 */

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/pricing', name: 'pricing' },
  { path: '/login', name: 'login' },
]

async function settle(page: import('@playwright/test').Page) {
  // Wait for the app shell, not just the document. These routes render a
  // marketing layout with a header; if it is absent the page redirected (often
  // to /login) and the screenshot would silently capture the wrong screen.
  // Short timeout on purpose: /login legitimately renders without any of these,
  // and a long wait it always misses is 20 seconds burned on every login test.
  await page
    .waitForSelector('header, main, [role="banner"]', { state: 'attached', timeout: 5000 })
    .catch(() => {
      // Fall through: the snapshot below will show what actually rendered,
      // which is more useful than aborting with no evidence.
    })

  // Inter is loaded from Google Fonts with `display=swap`, so text paints in a
  // fallback face until each weight arrives. `document.fonts.ready` alone is
  // not enough: it settles the requests made so far, and MUI only requests the
  // heavy weights once the display type actually mounts. That left the hero
  // headline being captured mid-swap, ~8% narrower than its true setting, which
  // diffed 3% of the frame. Explicitly load every weight the marketing surface
  // uses before we capture anything, but bound each weight so one slow fetch
  // cannot hold a whole test on a flaky connection.
  await page.evaluate(async () => {
    const faces = [
      '400 16px Inter',
      '500 16px Inter',
      '600 16px Inter',
      '700 16px Inter',
      '800 16px Inter',
      '900 16px Inter',
    ]
    const deadline = performance.now() + 3500
    await Promise.allSettled(
      faces.map((f) => document.fonts.load(f).then(
        () => undefined,
        () => undefined,
      ))
    )
    const remaining = Math.max(0, deadline - performance.now())
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
    await Promise.race([
      document.fonts.ready,
      new Promise((_r) => setTimeout(_r, 1500)),
    ])
  })

  // ThemeContext writes `data-theme` onto <html> on mount. Capturing before
  // that lands catches the pre-theme state — which is why the dark projects
  // intermittently disagreed with their own baseline. Wait for the attribute,
  // then for the colour transition it triggers to finish.
  await page
    .waitForFunction(() => document.documentElement.hasAttribute('data-theme'), null, {
      timeout: 4000,
    })
    .catch(() => {
      // /login never sets it, so this is a short wait rather than a long one:
      // every test that pays the full timeout is 15 seconds wasted across
      // eight runs. The catch keeps the screenshot useful either way.
    })

  // One frame after layout so framer-motion's initial transform is committed.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  )
}

for (const route of ROUTES) {
  test(`${route.name} renders and matches its baseline`, async ({ page }) => {
    // `domcontentloaded` rather than `load`: the dev server runs a PWA service
    // worker and the pages hold long-lived requests, so `load` can hang well
    // past the point where the UI is visually complete.
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    expect(response?.ok(), `${route.path} did not return 2xx`).toBeTruthy()

    await settle(page)

    await expect(page).toHaveScreenshot(`${route.name}.png`, { fullPage: false })
  })
}

/**
 * Distinct rendered colours, normalised to `rgb(r, g, b)`.
 *
 * Computed styles can hold several colours at once (gradients, multi-layer
 * shadows), so this parses the first rgb() triple and re-emits a canonical
 * string rather than passing the raw value through.
 */
async function renderedColours(page: import('@playwright/test').Page, minChroma = 0) {
  return page.evaluate((min) => {
    const out = new Map<string, number>()
    for (const el of Array.from(document.querySelectorAll('*')).slice(0, 6000)) {
      const s = getComputedStyle(el)
      for (const v of [s.color, s.backgroundColor, s.borderTopColor, s.borderColor]) {
        const m = /rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(v)
        if (!m) continue
        const [r, g, b] = [m[1], m[2], m[3]].map(Number)
        if (![r, g, b].every(Number.isFinite)) continue
        // Cheap "is this a colour rather than a grey?" measure.
        if (Math.max(r, g, b) - Math.min(r, g, b) < min) continue
        const css = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
        out.set(css, (out.get(css) ?? 0) + 1)
      }
    }
    return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([css]) => css)
  }, minChroma)
}

/**
 * The documented brand primary must reach a real surface.
 *
 * The application-wide colour overhaul made the master palette (see
 * context/ThemeContext.tsx METICLE_COLORS and scripts/design/palette.mjs) the
 * identity: primary blue #2F80ED replaced the retired navy #0F4C81 family.
 * /login genuinely renders it — so this asserts it there, where the claim is
 * true today.
 */
test('brand primary reaches the rendered login surface', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await settle(page)
  expect(await renderedColours(page)).toContain('rgb(47, 128, 237)') // #2F80ED
})

/**
 * The marketing home page must paint with the master brand palette — the
 * centralised tokens in context/ThemeContext.tsx (METICLE_COLORS), index.css
 * (--mc-*) and mobile/src/theme.tsx that the colour overhaul migrated the whole
 * surface onto.
 *
 * This asserts presence, not absence. A previous version tried to assert "no
 * other hue may appear" and was wrong: status colours (amber/red/green) are
 * legitimate, and gradients produce multi-value computed styles. Detecting
 * *new* colours is scripts/design/lint.mjs's job, and it does it at the source,
 * where it is exact.
 */
test('marketing home page paints with the master brand palette', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await settle(page)

  const colours = await renderedColours(page, 8)
  // Primary #2F80ED — the CTA fills and links.
  expect(colours, 'brand primary should reach the rendered page').toContain('rgb(47, 128, 237)')
  // Success deep #087A55 — the AA-safe darkened sibling of emerald #10B981,
  // used for small text where the raw emerald is too light.
  expect(colours, 'text-safe emerald should reach the rendered page').toContain('rgb(8, 122, 85)')
  // Ink #17202A — the headline on the now-white hero.
  expect(colours, 'brand ink should reach the rendered page').toContain('rgb(23, 32, 42)')
})

/**
 * Lenis smooth scrolling is enabled on the public marketing surface and scoped
 * so MUI transient panels (menus, dialogs, drawers, pickers) keep native scroll.
 *
 * The harness pretends reduced motion is not requested only for these checks
 * because the bridge deliberately refuses to start Lenis when the browser asks
 * for reduced motion. That refusal is the right behavior; here we verify the
 * running path, not the reduced-motion bypass.
 */
async function withLenisMotion(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    if (typeof window.matchMedia !== 'function') return
    const native = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => {
      const result = native(query)
      if (query === '(prefers-reduced-motion: reduce)') {
        // Only override the matches signal. Keep the object Playwright expects
        // (it carries internal test helpers such as _test in some runner
        // versions), so we mutate the live MediaQueryList rather than returning
        // a plain object.
        Object.defineProperty(result, 'matches', {
          value: false,
          configurable: true,
          enumerable: true,
          writable: true,
        })
      }
      return result
    }
  })
}

test('Lenis smooth scrolling is active on the marketing home page', async ({ page }) => {
  await withLenisMotion(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await settle(page)

  const state = await page.evaluate(() => ({
    lenisEnabled: document.documentElement.getAttribute('data-lenis-enabled'),
  }))

  expect(state.lenisEnabled, 'data-lenis-enabled should be set on <html> on the marketing surface').toBe('true')
})

test('MUI panels keep native scroll via data-lenis-prevent', async ({ page }) => {
  await withLenisMotion(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await settle(page)

  const before = await page.evaluate(() => ({
    lenisEnabled: document.documentElement.getAttribute('data-lenis-enabled'),
    lenisPrevent: document.documentElement.getAttribute('data-lenis-prevent'),
  }))
  expect(before.lenisEnabled, 'data-lenis-enabled should be set before opening the panel').toBe('true')
  expect(before.lenisPrevent, 'data-lenis-prevent should be absent before opening the panel').toBeNull()

  // Use a mobile viewport so the header exposes its hamburger drawer — the
  // representative MUI panel (MuiDrawer-root) that the bridge must mark with
  // data-lenis-prevent so the drawer keeps native scroll.
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(150)

  const hasOpenMenuButton = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Open menu"]')
    return b !== null && b.offsetParent !== null
  })
  expect(hasOpenMenuButton, 'mobile header should show the Open menu button').toBe(true)

  await page.locator('button[aria-label="Open menu"]').first().click()
  await page.waitForSelector('.MuiDrawer-root', { state: 'attached', timeout: 4000 }).catch(() => {})

  const after = await page.evaluate(() => ({
    lenisPrevent: document.documentElement.getAttribute('data-lenis-prevent'),
    panelOpen: document.querySelector('.MuiDrawer-root') !== null &&
      document.body.innerText.includes('Solutions'),
  }))

  expect(after.panelOpen, 'mobile drawer should have opened and contain the Solutions link').toBe(true)
  expect(after.lenisPrevent, 'data-lenis-prevent should be set while the drawer is open').toBe('true')

  await page.locator('button[aria-label="Close menu"]').first().click()
  await page.waitForSelector('.MuiDrawer-root', { state: 'detached', timeout: 4000 }).catch(() => {})

  const closed = await page.evaluate(() => ({
    lenisPrevent: document.documentElement.getAttribute('data-lenis-prevent'),
  }))
  expect(closed.lenisPrevent, 'data-lenis-prevent should be cleared after the drawer closes').toBeNull()
})

test('Lenis is not enabled on the authenticated app routes', async ({ page }) => {
  await withLenisMotion(page)

  for (const path of ['/dashboard', '/settings']) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    // Authenticated routes redirect to login when there is no session; that is
    // fine — the marketing bridge should still not have enabled Lenis for the
    // auth surface or the app surfaces.
    expect(response?.ok() || response?.status() === 302).toBeTruthy()

    const state = await page.evaluate(() => ({
      lenisEnabled: document.documentElement.getAttribute('data-lenis-enabled'),
    }))

    expect(state.lenisEnabled, `${path} should not set data-lenis-enabled on <html>`).toBeNull()
  }
})