import { describe, it, expect } from 'vitest'
import { buildDigestEmailContent } from './email.service'
import { buildEmailHtml, buildCodeEmailHtml, buildStatusEmailHtml } from './email.template'

function assertRules(html: string, label: string) {
  expect(html, label).not.toContain('text-transform:uppercase')
  const heavy = html.match(/font-weight:\s*(700|800|900)\b/g) ?? []
  expect(heavy, `${label} heavy weights: ${heavy.join(',')}`).toHaveLength(0)
}

describe('email typography rules (no uppercase, max weight 600)', () => {
  it('digest email (weekly/plain HTML service builder)', () => {
    const html = buildDigestEmailContent('A. Manager', 'weekly' as never, '2026-10-09', {
      totals: { scheduled: 0, completed: 0, missed: 0, late: 0 },
      attention: [],
      incidents: [],
      visits: [],
    } as never)
    assertRules(html, 'digest')
    expect(html).toContain('font-weight:600')
  })

  it('shared template wrapper: generic + code + status-chip paths', () => {
    const generic = buildEmailHtml('Typography check', 'Welcome aboard', '<tr><td>Body content.</td></tr>', { label: 'Open MeticleCare', url: 'https://example.com' })
    assertRules(generic, 'template:generic')
    expect(generic).toContain('font-weight:600')

    const code = buildCodeEmailHtml('482913')
    assertRules(code, 'template:code')

    for (const status of ['approved', 'rejected', 'pending', 'info'] as const) {
      const statusHtml = buildStatusEmailHtml('Leave request', 'Your leave was reviewed', status, status.toUpperCase(), ['Detail line one'], { label: 'View', url: 'https://example.com' })
      assertRules(statusHtml, `template:status:${status}`)
    }
  })
})
