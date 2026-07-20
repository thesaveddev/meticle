import { getDb } from '../db/database'
import * as cheerio from 'cheerio'

export async function enrichLead(leadId: number): Promise<{ name: string; email: string; phone: string; website: string; source: string } | null> {
  const db = getDb()
  const lead: any = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId)
  if (!lead) return null

  let contact: { name: string; email: string; phone: string; website: string; source: string } = {
    name: '', email: '', phone: lead.phone || '', website: '', source: ''
  }

  // Source 1: CQC provider detail page (free, no auth)
  console.log(`  [1/5] CQC detail page...`)
  const cqcDetail = await scrapeCqcDetailPage(lead.provider_name)
  if (cqcDetail) {
    contact.name = cqcDetail.managerName || contact.name
    contact.phone = cqcDetail.phone || contact.phone
    contact.website = cqcDetail.website || contact.website
    contact.source = 'cqc-detail'
    console.log(`    → Manager: ${contact.name || 'not found'}, Phone: ${contact.phone || 'none'}`)
  }

  // Source 2: carehome.co.uk profile (most homes listed here)
  if (!contact.name || !contact.email) {
    console.log(`  [2/5] carehome.co.uk...`)
    const ch = await scrapeCareHomeCoUk(lead.provider_name, lead.address)
    if (ch) {
      contact.name = ch.managerName || contact.name
      contact.email = ch.email || contact.email
      contact.phone = ch.phone || contact.phone
      contact.website = ch.website || contact.website
      if (ch.managerName) contact.source = 'carehome.co.uk'
      console.log(`    → Manager: ${ch.managerName || 'none'}, Email: ${ch.email || 'none'}`)
    }
  }

  // Source 3: Google search for the provider + "registered manager"
  if (!contact.name) {
    console.log(`  [3/5] Google search...`)
    const google = await googleSearchManager(lead.provider_name, lead.address)
    if (google) {
      contact.name = google.name || contact.name
      contact.email = google.email || contact.email
      contact.phone = google.phone || contact.phone
      if (google.name) contact.source = 'google-search'
      console.log(`    → Manager: ${google.name || 'none'}`)
    }
  }

  // Source 4: Email pattern guessing if we have a name and website
  if (contact.name && !contact.email && contact.website) {
    console.log(`  [4/5] Email guessing...`)
    const guessed = await guessEmailFromName(contact.name, contact.website)
    if (guessed) {
      contact.email = guessed
      contact.source = contact.source || 'email-guess'
      console.log(`    → Email: ${guessed}`)
    }
  }

  // Source 5: Try to find website + email from Google if not already found
  if (!contact.website || (!contact.email && contact.name)) {
    console.log(`  [5/5] Website + email search...`)
    const web = await findWebsiteAndEmail(lead.provider_name, lead.address, contact.name)
    if (web.website && !contact.website) contact.website = web.website
    if (web.email && !contact.email) contact.email = web.email
    if (web.phone && !contact.phone) contact.phone = web.phone
    if (web.email) contact.source = contact.source || 'web-scrape'
    console.log(`    → Website: ${web.website || 'none'}, Email: ${web.email || 'none'}`)
  }

  // Save to database
  if (contact.name || contact.email || contact.phone) {
    db.prepare(`UPDATE leads SET contact_name = COALESCE(NULLIF(?, ''), contact_name), contact_email = COALESCE(NULLIF(?, ''), contact_email), contact_phone = COALESCE(NULLIF(?, ''), contact_phone), contact_source = COALESCE(NULLIF(?, ''), contact_source), notes = COALESCE(notes || char(10), '') || ?, status = CASE WHEN status = 'new' THEN 'enriched' ELSE status END, updated_at = datetime('now') WHERE id = ?`)
      .run(contact.name, contact.email, contact.phone, contact.source, `Website: ${contact.website}`, leadId)
  }

  return contact.name || contact.email ? contact : null
}

// ── Source 1: CQC detail page ──
async function scrapeCqcDetailPage(providerName: string): Promise<{ managerName: string; phone: string; website: string } | null> {
  try {
    // Search CQC for this provider to get their detail page URL
    const searchUrl = `https://www.cqc.org.uk/search/all?care-directory&mode=html&name=${encodeURIComponent(providerName)}`
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) return null
    const html = await res.text()

    // Find the "Full details" link
    const detailMatch = html.match(/href="(\/location\/[^"]+)"[^>]*>Full details/i)
    if (!detailMatch) return null

    const detailUrl = `https://www.cqc.org.uk${detailMatch[1]}`
    const detailRes = await fetch(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!detailRes.ok) return null
    const detailHtml = await detailRes.text()
    const $ = cheerio.load(detailHtml)

    // Extract registered manager name
    let managerName = ''
    const pageText = $('body').text()
    const mgrMatch = pageText.match(/Registered manager[:\s]*([A-Z][a-z]+ [A-Z][a-z]+)/i)
    if (mgrMatch) managerName = mgrMatch[1].trim()
    if (!managerName) {
      const mgr2 = pageText.match(/Manager[:\s]*([A-Z][a-z]+ [A-Z][a-z]+)/i)
      if (mgr2) managerName = mgr2[1].trim()
    }

    // Extract phone
    const phone = pageText.match(/(?:\(?\d{3,5}\)?\s?\d{4,6}\s?\d{2,4})/)?.[0] || ''

    // Extract website
    const website = $('a[href*="http"]').filter((_, el) => {
      const h = $(el).attr('href') || ''
      return h.includes('http') && !h.includes('cqc.org') && !h.includes('gov.uk')
    }).first().attr('href') || ''

    return { managerName, phone, website }
  } catch { return null }
}

// ── Source 2: carehome.co.uk ──
async function scrapeCareHomeCoUk(providerName: string, address: string): Promise<{ managerName: string; email: string; phone: string; website: string } | null> {
  try {
    // The provider name on carehome.co.uk often doesn't include "Limited" or "Ltd"
    const cleanName = providerName.replace(/ltd|limited|services|care/gi, '').trim().slice(0, 40)
    const searchUrl = `https://www.carehome.co.uk/search/?q=${encodeURIComponent(cleanName)}`
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) return null
    const html = await res.text()
    const $ = cheerio.load(html)

    // Find the first search result
    const firstResult = $('.search-result, .result-item, [class*="result"]').first()
    if (!firstResult.length) return null

    const resultUrl = firstResult.find('a').first().attr('href') || ''
    if (!resultUrl) return null

    const detailUrl = resultUrl.startsWith('http') ? resultUrl : `https://www.carehome.co.uk${resultUrl}`
    const detailRes = await fetch(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!detailRes.ok) return null
    const detailHtml = await detailRes.text()
    const $$ = cheerio.load(detailHtml)

    const pageText = $$('body').text()

    // Manager name
    const mgr = pageText.match(/(?:Manager|Registered Manager)[:\s]*([A-Z][a-z]+ [A-Z][a-z]+)/i)
    const managerName = mgr ? mgr[1].trim() : ''

    // Email - carehome.co.uk sometimes has it
    const emailMatch = pageText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
    const email = emailMatch ? emailMatch[1] : ''

    // Phone
    const phone = pageText.match(/(?:\(?\d{3,5}\)?\s?\d{4,6}\s?\d{2,4})/)?.[0] || ''

    // Website - carehome.co.uk sometimes links to the provider's own site
    const website = $$('a[href*="http"]').filter((_, el) => {
      const h = $$(el).attr('href') || ''
      return h.includes('http') && !h.includes('carehome.co.uk') && !h.includes('cqc.org')
    }).first().attr('href') || ''

    return { managerName, email, phone, website }
  } catch { return null }
}

// ── Source 3: Google search ──
async function googleSearchManager(providerName: string, address: string): Promise<{ name: string; email: string; phone: string } | null> {
  try {
    const query = `${providerName} registered manager contact`
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    })
    if (!res.ok) return null
    const html = await res.text()

    // Extract any name that looks like a person
    const names = [...html.matchAll(/([A-Z][a-z]+ [A-Z][a-z]+)/g)].map(m => m[1])
      .filter(n => !n.match(/^(Care|Home|Quality|Commission|Google|Search|All|News|Images|Maps|Videos|Books|Page|Next|Previous)$/i))
      .filter(n => n.length > 5 && n.split(' ').length >= 2)

    // Remove common non-person names
    const stopWords = ['United Kingdom', 'Great Britain', 'Local Authority', 'High Street', 'Church Street']
    const personNames = names.filter(n => !stopWords.includes(n))

    // Extract emails
    const emails = [...html.matchAll(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)].map(m => m[1])
    const validEmail = emails.find(e => !e.includes('google') && !e.includes('example'))

    // Extract phone numbers from the area
    const phones = [...html.matchAll(/(?:\(?\d{3,5}\)?\s?\d{4,6}\s?\d{2,4})/g)].map(m => m[0])

    return {
      name: personNames[0] || '',
      email: validEmail || '',
      phone: phones[0] || '',
    }
  } catch { return null }
}

// ── Source 4: Email guessing ──
async function guessEmailFromName(name: string, website: string): Promise<string | null> {
  try {
    const domain = website.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '')
    if (!domain.includes('.')) return null

    const parts = name.toLowerCase().split(' ')
    const formats = [
      `${parts[0]}@${domain}`,
      `${parts[0]}.${parts[parts.length - 1]}@${domain}`,
      `${parts[0][0]}${parts[parts.length - 1]}@${domain}`,
      `${parts.join('.')}@${domain}`,
    ]

    // Try Hunter.io if key is available
    if (process.env.HUNTER_API_KEY) {
      for (const email of formats) {
        try {
          const hRes = await fetch(
            `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${process.env.HUNTER_API_KEY}`
          )
          if (hRes.ok) {
            const d: any = await hRes.json()
            if (d.data?.status === 'valid' || d.data?.result === 'deliverable') return email
          }
        } catch { continue }
      }
    }

    // Return the most likely format without verification
    return formats[1] // firstname.lastname@domain — most common in UK care sector
  } catch { return null }
}

// ── Source 5: Find website + email from search ──
async function findWebsiteAndEmail(providerName: string, address: string, managerName: string): Promise<{ website: string; email: string; phone: string }> {
  try {
    // Search for the provider's official website
    const query = `${providerName} ${(address || '').split(',')[0] || ''} contact email`
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) return { website: '', email: '', phone: '' }
    const html = await res.text()

    // Extract potential website URLs
    const urls = [...html.matchAll(/https?:\/\/(?!www\.google\.|webcache\.|youtube\.|facebook\.|twitter\.|linkedin\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s"']*/g)].map(m => m[0])
    const cleanUrls = [...new Set(urls)].filter(u => {
      try { const h = new URL(u); return !h.hostname.includes('google') && !h.hostname.includes('cqc') }
      catch { return false }
    })

    const website = cleanUrls[0] || ''

    // Extract emails from search results
    const emails = [...html.matchAll(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)].map(m => m[1])
    const validEmails = emails.filter(e => !e.includes('google') && !e.includes('example') && !e.includes('schema'))

    // If we found a website, try to scrape its contact page
    let email = validEmails[0] || ''
    let phone = ''
    if (website && !email) {
      try {
        const contactUrl = `${website.replace(/\/$/, '')}/contact`
        const contactRes = await fetch(contactUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        })
        if (contactRes.ok) {
          const contactHtml = await contactRes.text()
          const contactEmails = [...contactHtml.matchAll(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)].map(m => m[1])
          email = contactEmails[0] || email
          const contactPhone = contactHtml.match(/(?:\(?\d{3,5}\)?\s?\d{4,6}\s?\d{2,4})/)?.[0] || ''
          phone = contactPhone
        }
      } catch { /* website scraping is best-effort */ }
    }

    return { website, email, phone }
  } catch { return { website: '', email: '', phone: '' } }
}

export async function bulkEnrich(status: string = 'new', limit: number = 20): Promise<{ found: number; attempted: number }> {
  const db = getDb()
  const leads = db.prepare('SELECT id FROM leads WHERE status = ? LIMIT ?').all(status, limit) as { id: number }[]
  let found = 0
  for (let i = 0; i < leads.length; i++) {
    console.log(`\nEnriching ${i + 1}/${leads.length}: lead #${leads[i].id}`)
    const result = await enrichLead(leads[i].id)
    if (result && (result.name || result.email)) found++
    await new Promise(r => setTimeout(r, 1000)) // be polite between requests
  }
  return { found, attempted: leads.length }
}
