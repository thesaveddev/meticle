import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FIcon, type MarketingIconName } from './icons'
import { M } from '../../styles/marketing-tokens'

/**
 * Figma 02 (Navigation states) dropdown glyph guard.
 * The menu icons are two-tone: slate structure (.mi-base) with brand-navy
 * accents (.mi-accent); heart is solid navy and home is solid slate at rest.
 * ModuleItem recolors .mi-base to navy on hover/selected via CSS.
 */

function strokes(name: MarketingIconName) {
  const { container } = render(<FIcon name={name} />)
  const svg = container.querySelector('svg')
  expect(svg).not.toBeNull()
  const els = Array.from(svg!.querySelectorAll('.mi-base, .mi-accent'))
  const base = els
    .filter((el) => el.classList.contains('mi-base'))
    .map((el) => el.getAttribute('stroke'))
  const accent = els
    .filter((el) => el.classList.contains('mi-accent'))
    .map((el) => el.getAttribute('stroke'))
  return { base, accent }
}

describe('marketing dropdown icons match the Figma two-tone set', () => {
  it('heart is solid navy (no slate structure)', () => {
    const { base, accent } = strokes('heart')
    expect(base).toEqual([])
    expect(accent).toEqual([])
  })

  it('pill: slate capsule with navy divider', () => {
    const { base, accent } = strokes('pill')
    expect(base).toEqual([M.slate])
    expect(accent).toEqual([M.navy])
  })

  it('users: slate front body, navy heads and back figure', () => {
    const { base, accent } = strokes('users')
    expect(base).toEqual([M.slate])
    expect(accent).toEqual([M.navy, M.navy, M.navy])
  })

  it('calendar: slate frame with navy hangers and top stripe', () => {
    const { base, accent } = strokes('calendar')
    expect(base).toEqual([M.slate])
    expect(accent).toEqual([M.navy, M.navy, M.navy])
  })

  it('alert: slate triangle with navy exclamation', () => {
    const { base, accent } = strokes('alert')
    expect(base).toEqual([M.slate])
    expect(accent).toEqual([M.navy, M.navy])
  })

  it('chart: navy bars over a slate baseline', () => {
    const { base, accent } = strokes('chart')
    expect(base).toEqual([M.slate])
    expect(accent).toEqual([M.navy, M.navy, M.navy])
  })

  it('home is solid slate at rest', () => {
    const { base, accent } = strokes('home')
    expect(base).toEqual([M.slate, M.slate])
    expect(accent).toEqual([])
  })

  it('sparkles: slate star with a navy plus badge', () => {
    const { base, accent } = strokes('sparkles')
    expect(base).toEqual([M.slate])
    expect(accent).toEqual([M.navy])
  })

  it('phone: slate body with a navy dot', () => {
    const { base, accent } = strokes('phone')
    expect(base).toEqual([M.slate])
    expect(accent).toEqual([M.navy])
  })

  it('utility glyphs stay single-color', () => {
    for (const name of ['arrowRight', 'chevronDown', 'close', 'check'] as const) {
      const { container } = render(<FIcon name={name} />)
      expect(container.querySelectorAll('.mi-base, .mi-accent')).toHaveLength(0)
    }
  })
})
