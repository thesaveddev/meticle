import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SITE_URL = process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || 'https://meticlecare.com'

// Every public marketing URL. Keep in step with apps/web/public/sitemap.xml
// (the checked-in file is authoritative) and apps/web/scripts/seo-pages.ts
// (every path here needs a prerender entry or it ships the wrong meta).
const publicRoutes: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/platform', changefreq: 'monthly', priority: '0.9' },
  { path: '/solutions/domiciliary-care', changefreq: 'monthly', priority: '0.9' },
  { path: '/solutions/supported-living', changefreq: 'monthly', priority: '0.9' },
  { path: '/compliance', changefreq: 'monthly', priority: '0.9' },
  { path: '/compliance/cqc', changefreq: 'monthly', priority: '0.8' },
  { path: '/compliance/care-inspectorate', changefreq: 'monthly', priority: '0.8' },
  { path: '/compliance/ciw', changefreq: 'monthly', priority: '0.8' },
  { path: '/compliance/rqia', changefreq: 'monthly', priority: '0.8' },
  { path: '/features/care-management', changefreq: 'monthly', priority: '0.8' },
  { path: '/features/medication', changefreq: 'monthly', priority: '0.8' },
  { path: '/features/workforce', changefreq: 'monthly', priority: '0.8' },
  { path: '/features/scheduling', changefreq: 'monthly', priority: '0.8' },
  { path: '/features/risk-management', changefreq: 'monthly', priority: '0.8' },
  { path: '/features/reporting', changefreq: 'monthly', priority: '0.8' },
  { path: '/features/family-portal', changefreq: 'monthly', priority: '0.8' },
  { path: '/features/ai', changefreq: 'monthly', priority: '0.8' },
  { path: '/features', changefreq: 'monthly', priority: '0.9' },
  { path: '/how-it-works', changefreq: 'monthly', priority: '0.8' },
  { path: '/pricing', changefreq: 'weekly', priority: '0.9' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/case-studies', changefreq: 'monthly', priority: '0.6' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/download', changefreq: 'monthly', priority: '0.8' },
  { path: '/security', changefreq: 'monthly', priority: '0.7' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/blog/inspection-ready-care-records', changefreq: 'monthly', priority: '0.7' },
  { path: '/blog/domiciliary-care-scheduling', changefreq: 'monthly', priority: '0.7' },
  { path: '/blog/responsible-ai-in-care', changefreq: 'monthly', priority: '0.7' },
  { path: '/blog/medication-safety-in-domiciliary-care', changefreq: 'monthly', priority: '0.7' },
  { path: '/learn', changefreq: 'monthly', priority: '0.7' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/cookies', changefreq: 'yearly', priority: '0.3' },
  { path: '/delete-account', changefreq: 'yearly', priority: '0.3' },
]

const lastmod = new Date().toISOString().split('T')[0]

const urls = publicRoutes
  .map(
    (r) => `  <url>\n    <loc>${SITE_URL}${r.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
  )
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`

const outPath = path.resolve(__dirname, '..', 'public', 'sitemap.xml')
fs.writeFileSync(outPath, sitemap, 'utf8')
console.log(`Sitemap written to ${outPath} with ${publicRoutes.length} URLs`)
console.log(`Site URL: ${SITE_URL}`)
