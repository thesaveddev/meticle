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
  // uses before we capture anything.
  await page.evaluate(async () => {
    const faces = [
      '400 16px Inter',
      '500 16px Inter',
      '600 16px Inter',
      '700 16px Inter',
      '800 16px Inter',
      '900 16px Inter',
    ]
    await Promise.all(
      faces.map((f) => document.fonts.load(f).catch(() => undefined))
    )
    await document.fonts.ready
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