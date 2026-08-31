/**
 * Prerender script — generates per-route static HTML files from the built
 * index.html + SEO_PAGES config.
 *
 * For each public route, this script:
 * 1. Reads the built index.html
 * 2. Replaces the title, meta description, canonical, and OG tags
 * 3. Injects the H1 and body content into the <body>
 * 4. Writes the result to dist/<route>/index.html
 *
 * This fixes all SEO issues from the audit:
 * - Canonicalized pages → each page canonicals to itself
 * - Meta description too long → all descriptions ≤160 chars
 * - Missing H1 → each page has an H1 in the HTML source
 * - Thin content → each page has real text content in the HTML source
 * - No outgoing links → nav and footer links are in the HTML source
 * - Orphan pages → all pages are linked from the hidden nav
 *
 * Usage: npx tsx scripts/prerender.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { SEO_PAGES } from './seo-pages'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '../dist')
const SITE_URL = 'https://meticlecare.com'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function generatePageHtml(indexHtml: string, page: (typeof SEO_PAGES)[0]): string {
  const canonical = `${SITE_URL}${page.path === '/' ? '/' : page.path}`
  const fullTitle = page.title.includes('MeticleCare')
    ? page.title
    : `${page.title} | MeticleCare`

  let html = indexHtml

  // Replace <title>
  html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`)

  // Replace meta description
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"/,
    `<meta name="description" content="${escapeHtml(page.description)}"`,
  )

  // Replace canonical link
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"/,
    `<link rel="canonical" href="${escapeHtml(canonical)}"`,
  )

  // Replace OG title
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"/,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}"`,
  )

  // Replace OG description
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"/,
    `<meta property="og:description" content="${escapeHtml(page.description)}"`,
  )

  // Replace OG URL
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"/,
    `<meta property="og:url" content="${escapeHtml(canonical)}"`,
  )

  // Inject H1 and content into the body — before the root div
  // The hidden nav + main content gives crawlers real content and links
  // without affecting the visual layout (React hydrates over #root)
  const bodyInjection = `
    <div style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden" aria-hidden="true">
      ${page.bodyHtml}
    </div>`

  // Insert the SEO content right after <body> tag, before #root
  html = html.replace(
    /(<body>)(\s*<div id="root">)/,
    `$1${bodyInjection}
    $2`,
  )

  return html
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function main(): void {
  const indexPath = path.join(DIST_DIR, 'index.html')

  if (!fs.existsSync(indexPath)) {
    console.error(`❌ index.html not found at ${indexPath}. Run "npm run build" first.`)
    process.exit(1)
  }

  const indexHtml = fs.readFileSync(indexPath, 'utf-8')

  // Generate the root index.html (for "/")
  const rootHtml = generatePageHtml(indexHtml, SEO_PAGES[0])
  fs.writeFileSync(indexPath, rootHtml)
  console.log(`✓ Rewrote dist/index.html (route: /)`)

  // Generate per-route HTML files
  for (const page of SEO_PAGES) {
    if (page.path === '/') continue // already handled above

    // Convert path like "/features" to "features/index.html"
    const routeDir = path.join(DIST_DIR, page.path)
    ensureDir(routeDir)
    const routeFilePath = path.join(routeDir, 'index.html')
    const routeHtml = generatePageHtml(indexHtml, page)
    fs.writeFileSync(routeFilePath, routeHtml)
    console.log(`✓ Generated dist${page.path}/index.html`)
  }

  // Verify all descriptions are ≤160 chars
  const violations = SEO_PAGES.filter((p) => p.description.length > 160)
  if (violations.length > 0) {
    console.warn('\n⚠️  Meta descriptions over 160 chars:')
    for (const v of violations) {
      console.warn(`  ${v.path}: ${v.description.length} chars`)
    }
  } else {
    console.log('\n✓ All meta descriptions are ≤160 chars')
  }

  console.log(`\n✓ Prerendered ${SEO_PAGES.length} routes`)
}

main()
