import { getDb } from '../db/database'
import * as cheerio from 'cheerio'

const CQC_SEARCH_URL = 'https://www.cqc.org.uk/search/all'
const TARGET_SPECIALISMS = ['Learning disability', 'Dementia', 'Mental health']

export async function scrapeCqcProviders(_region?: string, limit: number = 50): Promise<{ total: number; added: number }> {
  const db = getDb()
  let totalFound = 0
  let added = 0

  for (const specialism of TARGET_SPECIALISMS) {
    for (let page = 1; page <= 3; page++) {
      if (added >= limit) break
      const url = `${CQC_SEARCH_URL}?care-directory&mode=html&specialisms=${encodeURIComponent(specialism)}&page=${page}`
      console.log(`  Scraping ${specialism} page ${page}...`)

      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          },
        })
        if (!res.ok) { console.log(`  HTTP ${res.status}`); continue }
        const html = await res.text()

        const $ = cheerio.load(html)

        // Find all result cards - they're in divs with location data
        $('.search-result, [class*="result"], [class*="location-card"], article').each((_, el) => {
          const text = $(el).text().trim()
          if (!text || text.length < 20) return

          // Skip if it's not a care provider result
          if (!text.match(/Overall|Regulations met|action|Full details/i)) return

          // Extract name - the name is the first significant heading-like text
          const headings = $(el).find('h1, h2, h3, strong').toArray()
          const nameEl = headings.find(h => {
            const t = $(h).text().trim()
            return t.length > 5 && t.length < 100 && !t.match(/^(Overall|Good|Requires|Inadequate|Outstanding|Not rated|Active|Archived|Loading|Page)$/i)
          })

          let name = nameEl ? $(nameEl).text().trim() : ''

          // Fallback: extract name from text pattern - look for text before address
          if (!name) {
            const nameMatch = text.match(/([A-Z][A-Za-z0-9 &'().,-]{5,80})\s*\n\s*\d+/)
            if (nameMatch) name = nameMatch[1].trim()
          }

          if (!name || name.length < 3) return
          totalFound++

          // Extract service type
          const typeMatch = text.match(/(Care home|Homecare|Services in your home|Supported living|Clinic|Dentist|GP practice|Hospice|Hospital|Mental health|Community service)/i)
          const type = typeMatch ? typeMatch[1].trim() : ''

          // Extract rating
          const ratingMatch = text.match(/Overall:\s*(Outstanding|Good|Requires improvement|Inadequate)/i)
          const rating = ratingMatch ? ratingMatch[1].trim() : null

          // Extract address - the line containing a UK postcode
          const addrMatch = text.match(/([^,\n]+,\s*[^,\n]+,\s*[^,\n]+,\s*[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2})/i)
          let address = addrMatch ? addrMatch[1].trim() : null

          // Fallback: grab text between the name and "Provided and run by"
          if (!address) {
            const providerIdx = text.indexOf('Provided and run by')
            const nameIdx = text.indexOf(name)
            if (providerIdx > nameIdx && nameIdx >= 0) {
              const mid = text.substring(nameIdx + name.length, providerIdx)
              const addrFallback = mid.match(/([^,\n]+,\s*[^,\n]+,\s*[^,\n]+)/)
              if (addrFallback) address = addrFallback[1].trim()
            }
          }

          // Extract phone
          const phoneMatch = text.match(/(?:\(?\d{3,5}\)?\s?\d{4,6}\s?\d{2,4})/)
          const phone = phoneMatch ? phoneMatch[0].trim() : null

          // Extract provider company name
          const provMatch = text.match(/Provided and run by:\s*([^,\n]+)/i)
          const provider = provMatch ? provMatch[1].trim() : null

          console.log(`    → ${name} | ${rating || 'No rating'} | ${address ? address.substring(0, 50) : 'No addr'}`)

          // Skip if we already have this provider
          const existing = db.prepare('SELECT id FROM leads WHERE provider_name = ?').get(name)
          if (existing) return

          db.prepare(`
            INSERT INTO leads (provider_name, address, phone, service_type, cqc_rating, contact_source, status, notes)
            VALUES (?, ?, ?, ?, ?, 'cqc-scrape', 'new', ?)
          `).run(
            name,
            address || null,
            phone || null,
            type || '',
            rating || null,
            `Type: ${type}. Provider: ${provider || 'N/A'}`
          )
          added++
        })
      } catch (e) {
        console.error(`  Error: ${(e as Error).message}`)
      }

      await new Promise(r => setTimeout(r, 1500))
    }
  }

  db.prepare(`INSERT INTO scrape_logs (source, providers_found, new_leads, details) VALUES (?, ?, ?, ?)`).run(
    'cqc-html', totalFound, added, `${TARGET_SPECIALISMS.join(', ')}, limit: ${limit}`
  )
  console.log(`  Done: found ${totalFound} total, added ${added} new`)

  return { total: totalFound, added }
}

export async function searchCqcByName(query: string) {
  return []
}
