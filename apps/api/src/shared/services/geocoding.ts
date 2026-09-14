import logger from '../utils/logger'

interface GeocodeResult {
  latitude: number
  longitude: number
  display_name?: string
}

/**
 * Geocode an address to lat/lng using Nominatim (OpenStreetMap).
 * Free for low-volume use — respect the 1 req/sec rate limit.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim().length < 3) return null

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address.trim())}&format=json&limit=1&countrycodes=gb`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MeticleCare/1.0 (care-management)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      logger.warn(`Geocoding failed with status ${response.status}`)
      return null
    }

    const results = await response.json()
    if (!Array.isArray(results) || results.length === 0) {
      logger.info(`No geocoding results for: ${address}`)
      return null
    }

    const result = results[0]
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      display_name: result.display_name,
    }
  } catch (error: any) {
    // Don't log AbortError — it's just a timeout
    if (error?.name !== 'TimeoutError' && error?.code !== 'ABORT_ERR') {
      logger.warn(`Geocoding error: ${error?.message || 'unknown'}`)
    }
    return null
  }
}
