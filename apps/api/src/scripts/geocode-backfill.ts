/**
 * Geocode Backfill Script
 * 
 * Finds all locations with an address but no latitude/longitude
 * and populates coordinates using Nominatim (OpenStreetMap).
 * 
 * Usage:
 *   npx tsx src/scripts/geocode-backfill.ts
 * 
 * Environment:
 *   DATABASE_URL  — PostgreSQL connection string
 */

import pg from 'pg'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'MeticleCare-Backfill/1.0'
const DELAY_MS = 1100 // Nominatim rate limit: 1 req/sec

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function geocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=gb`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

  console.log('Finding locations with address but no coordinates...')
  const { rows: locations } = await pool.query(`
    SELECT id, name, address 
    FROM locations 
    WHERE address IS NOT NULL 
      AND address != '' 
      AND (latitude IS NULL OR longitude IS NULL)
    ORDER BY created_at ASC
  `)

  console.log(`Found ${locations.length} locations to geocode\n`)

  if (locations.length === 0) {
    console.log('Nothing to do — all locations already have coordinates.')
    await pool.end()
    return
  }

  let success = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i]
    const progress = `[${i + 1}/${locations.length}]`

    process.stdout.write(`${progress} ${loc.name} — `)

    const geo = await geocode(loc.address)
    if (geo) {
      await pool.query(
        'UPDATE locations SET latitude = $1, longitude = $2 WHERE id = $3',
        [geo.latitude, geo.longitude, loc.id]
      )
      console.log(`${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)} ✓`)
      success++
    } else {
      console.log('no results, skipping ✗')
      failed++
    }

    // Rate limit: wait between requests
    if (i < locations.length - 1) await sleep(DELAY_MS)
  }

  console.log(`\nDone! ${success} geocoded, ${failed} failed, ${skipped} skipped`)
  await pool.end()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
