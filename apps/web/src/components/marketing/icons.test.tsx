import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FIcon, type MarketingIconName } from './icons'

/**
 * Figma dropdown glyph guard (platform + solutions panels).
 * Every menu glyph is a monochrome outline inheriting currentColor — the nav
 * renders the set in brand blue. The care-management glyph is a heart with a
 * pulse line inside (not a plain heart); the phone is a plain handset
 * outline with no dot.
 */

const GLYPHS: MarketingIconName[] = [
  'heart', 'pill', 'users', 'calendar', 'alert', 'chart', 'home', 'sparkles', 'phone',
]

function svgFor(name: MarketingIconName) {
  const { container } = render(<FIcon name={name} />)
  const svg = container.querySelector('svg')
  expect(svg).not.toBeNull()
  return svg!
}

describe('marketing dropdown icons match the Figma monochrome set', () => {
  it('no glyph hardcodes its own colour', () => {
    for (const name of GLYPHS) {
      const svg = svgFor(name)
      expect(svg.querySelectorAll('.mi-base, .mi-accent')).toHaveLength(0)
      const hardCoded = Array.from(svg.querySelectorAll('*')).filter(
        (el) => el.hasAttribute('stroke') || el.hasAttribute('fill'),
      )
      expect(hardCoded).toHaveLength(0)
    }
  })

  it('inherits currentColor from the SvgIcon root', () => {
    const svg = svgFor('pill')
    expect(svg.getAttribute('stroke')).toBe('currentColor')
    expect(svg.getAttribute('fill')).toBe('none')
  })

  it('heart is an outline heart with a pulse line inside', () => {
    const svg = svgFor('heart')
    const paths = svg.querySelectorAll('path')
    const lines = svg.querySelectorAll('polyline')
    expect(paths).toHaveLength(1)
    expect(lines).toHaveLength(1)
    expect(paths[0].getAttribute('d')).toContain('M20.84 4.61')
    expect(lines[0].getAttribute('points')).toBe('4 12 8 12 10 9.5 14 14.5 16 12 20 12')
  })

  it('phone is a plain handset outline with no dot', () => {
    const svg = svgFor('phone')
    expect(svg.querySelectorAll('rect')).toHaveLength(1)
    expect(svg.querySelectorAll('line, circle')).toHaveLength(0)
  })

  it('home keeps its door cutout', () => {
    const svg = svgFor('home')
    expect(svg.querySelectorAll('path, polyline')).toHaveLength(2)
  })

  it('utility glyphs stay single-color', () => {
    for (const name of ['arrowRight', 'chevronDown', 'close', 'check'] as const) {
      const { container } = render(<FIcon name={name} />)
      expect(container.querySelectorAll('.mi-base, .mi-accent')).toHaveLength(0)
    }
  })
})
