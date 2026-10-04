/**
 * Screenshots the dark bands on the home page and reports their computed
 * background, so the recolour can be verified in a picture rather than assumed
 * from the source. The visual regression harness captures `fullPage: false`,
 * so it only ever sees the first viewport and proves nothing about bands below
 * the fold — this covers that gap on demand.
 *
 *   node scripts/capture-sections.mjs
 */
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(1500)

const bands = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('div')) {
    const bg = getComputedStyle(el).backgroundColor
    // rgb(12, 27, 46) is M.dark. Only keep bands that fill the viewport width;
    // inner cards are far narrower.
    const r = el.getBoundingClientRect()
    if (bg === 'rgb(12, 27, 46)' && r.width >= 1200 && r.height > 200) {
      out.push({
        bg,
        height: Math.round(r.height),
        top: Math.round(r.top + window.scrollY),
        text: (el.innerText || '').trim().slice(0, 60),
      })
    }
  }
  return out
})

console.log(`dark bands found: ${bands.length}`)
bands.forEach((b, i) => {
  console.log(`  ${i}: bg=${b.bg} h=${b.height}px top=${b.top} — "${b.text.replace(/\n/g, ' ')}"`)
})

for (let i = 0; i < bands.length; i++) {
  const name = bands[i].text.toLowerCase().includes('clarity') ? 'section-cta' : 'section-ai'
  const target = page.locator('div').filter({ hasNot: page.locator('div') })
  await page.evaluate((t) => window.scrollTo(0, t - 40), bands[i].top)
  await page.waitForTimeout(300)
  const handles = await page.locator(`div[style], div`).all()
  // Screenshot by clip using the measured geometry instead of guessing ancestry.
  await page.screenshot({
    path: `${name}-${i}.png`,
    clip: { x: 0, y: 40, width: 1440, height: Math.min(700, bands[i].height) },
  })
  console.log(`wrote ${name}-${i}.png`)
}

await browser.close()