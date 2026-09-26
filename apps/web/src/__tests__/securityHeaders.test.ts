/**
 * The security headers must survive nginx's add_header inheritance rule.
 *
 * `add_header` directives are not merged across levels: a location block that
 * declares any add_header of its own replaces the whole inherited set from the
 * server block. Four blocks legitimately need their own Cache-Control, so each
 * of them silently discarded the security headers. Nothing failed, every page
 * still returned 200, and the Content-Security-Policy configured in nginx never
 * reached a single browser — the only headers a visitor saw were Cloudflare's
 * edge defaults. That is the worst kind of failure: invisible, and it looks
 * configured.
 *
 * This reads the config rather than making HTTP requests, because the deployed
 * behaviour is obscured by the CDN in front. It is the only place the rule can
 * be checked cheaply.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const NGINX = readFileSync(join(__dirname, '../../nginx.conf'), 'utf8')
const SNIPPET = readFileSync(join(__dirname, '../../security-headers.conf'), 'utf8')

/** Split the config into the server block and each location block. */
function blocks(): { name: string; body: string }[] {
  const result: { name: string; body: string }[] = []
  const pattern = /^\s*(server|location\s+[^\n{]*)\s*\{/gm
  const starts: { name: string; at: number }[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(NGINX)) !== null) {
    starts.push({ name: match[1].trim(), at: match.index })
  }
  starts.forEach((start, i) => {
    // Walk braces from the opening one to find the block's end.
    let depth = 0
    let cursor = NGINX.indexOf('{', start.at)
    const open = cursor
    for (; cursor < NGINX.length; cursor += 1) {
      if (NGINX[cursor] === '{') depth += 1
      if (NGINX[cursor] === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    const end = i + 1 < starts.length ? Math.min(cursor, starts[i + 1].at) : cursor
    result.push({ name: start.name, body: NGINX.slice(open, end) })
  })
  return result
}

describe('nginx security headers', () => {
  const all = blocks()

  it('finds the server block and the location blocks', () => {
    expect(all.some(b => b.name === 'server')).toBe(true)
    expect(all.filter(b => b.name.startsWith('location')).length).toBeGreaterThan(3)
  })

  it('re-includes the security headers in every block that sets its own add_header', () => {
    const offenders: string[] = []
    for (const block of all) {
      const declaresOwn = /^\s*add_header\s+(?!.*include)/m.test(block.body)
      if (!declaresOwn) continue
      if (!block.body.includes('include /etc/nginx/snippets/security-headers.conf')) {
        offenders.push(block.name)
      }
    }
    expect(offenders).toEqual([])
  })

  it('inlines no security header directly, so there is one source of truth', () => {
    // The server block and every location should include the snippet rather than
    // restate the headers. A copy here is how the two drifted apart before.
    const inline = NGINX.match(/^\s*add_header\s+(Strict-Transport-Security|Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy)/gm)
    expect(inline || []).toEqual([])
  })

  it('sends HSTS and a content security policy from the snippet', () => {
    expect(SNIPPET).toMatch(/Strict-Transport-Security/)
    expect(SNIPPET).toMatch(/Content-Security-Policy/)
  })

  it('does not send upgrade-insecure-requests, which is meaningless behind the CDN', () => {
    // Comments are excluded deliberately — the snippet explains in prose why the
    // directive is absent, and matching that would fail on the explanation.
    const directives = SNIPPET
      .split('\n')
      .filter(line => !/^\s*#/.test(line))
      .join('\n')
    expect(directives).not.toMatch(/upgrade-insecure-requests/)
  })

  it('allows only the origins this app actually uses', () => {
    const csp = /Content-Security-Policy "([^"]+)"/.exec(SNIPPET)?.[1] || ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain('https://fonts.gstatic.com')      // Google Fonts
    expect(csp).toContain('a.tile.openstreetmap.org')      // map tiles
    expect(csp).toContain('nominatim.openstreetmap.org')   // geocoding
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    // 'unsafe-eval' is a script-src escape hatch, not a style-src necessity.
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/)
  })
})
