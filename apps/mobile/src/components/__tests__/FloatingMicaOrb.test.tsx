/**
 * Proves the floating Mica orb cannot cover the navigation.
 *
 * ## What went wrong
 *
 * The orb is absolutely positioned inside an inset screen frame, but its drag
 * bounds were computed from the raw *window*: a dragged orb clamped 40px from
 * the bottom of the window — inside the roughly 68px tab bar — so a user could
 * park a live control on top of the tabs. `homeY` also sat 160px up on every
 * device regardless of the safe-area inset, which on a gesture-bar iPhone put
 * it in the home indicator.
 *
 * ## What is asserted
 *
 * For a spread of real device sizes, with and without a tab bar, the orb's whole
 * box plus the caller's bottom clearance stays above the frame's bottom edge, its
 * top stays below the frame's top, and it stays inside the frame horizontally.
 * A frame too short for the clearance clamps to the documented floor instead of
 * going off-screen.
 *
 * These are geometry proofs, not pixel proofs: they hold because the orb is
 * positioned only from these bounds. Anything drawn *into* the reserved space by
 * a screen is outside what a unit test can see — that is what the visual sweep
 * in docs/DESIGN_SYSTEM_AUDIT.md is for.
 */
import { orbBounds } from '../FloatingMicaOrb'
import { mica } from '../../theme'

/** The tab bar's own height, as App.tsx derives it for the clearance prop. */
const TAB_BAR = 68

const DEVICES = [
  { name: 'iPhone SE (1st gen portrait)', width: 320, height: 568, insetTop: 20, insetBottom: 0 },
  { name: 'iPhone 14', width: 390, height: 844, insetTop: 47, insetBottom: 34 },
  { name: 'Pixel 7', width: 412, height: 915, insetTop: 24, insetBottom: 0 },
  { name: 'small Android', width: 360, height: 640, insetTop: 24, insetBottom: 0 },
  { name: 'iPad portrait', width: 768, height: 1024, insetTop: 24, insetBottom: 20 },
] as const

describe('floating Mica orb bounds', () => {
  it.each(DEVICES)('keeps the orb clear of the tab bar on $name', device => {
    const bounds = orbBounds({ ...device, bottomClearance: TAB_BAR })
    const frameBottom = device.height - device.insetBottom

    // The whole box, the tab bar's height and the gap all sit above the frame's
    // bottom edge — so the orb can never be parked on the navigation.
    expect(bounds.homeY + bounds.boxHeight + TAB_BAR).toBeLessThanOrEqual(frameBottom)
    expect(bounds.maxY + bounds.boxHeight + TAB_BAR).toBeLessThanOrEqual(frameBottom)
  })

  it.each(DEVICES)('keeps the resting orb above the bottom edge with no tab bar on $name', device => {
    const bounds = orbBounds(device)
    const frameBottom = device.height - device.insetBottom
    expect(bounds.homeY + bounds.boxHeight).toBeLessThanOrEqual(frameBottom)
  })

  it.each(DEVICES)('keeps the orb inside the frame horizontally on $name', device => {
    const bounds = orbBounds({ ...device, bottomClearance: TAB_BAR })
    // Portrait fixtures: these devices inset at the top and bottom only, so the
    // frame's width is the window's width.
    const frameW = device.width
    expect(bounds.homeX).toBe(bounds.maxX)
    expect(bounds.maxX + mica.orb.size + mica.orb.sideInset).toBeLessThanOrEqual(frameW)
    expect(bounds.minX).toBeGreaterThanOrEqual(0)
    expect(bounds.maxX).toBeGreaterThanOrEqual(bounds.minX)
  })

  it('keeps the orb below the top of the frame, and floors rather than escapes', () => {
    const roomy = orbBounds({ width: 390, height: 844, insetTop: 47, insetBottom: 34, bottomClearance: TAB_BAR })
    expect(roomy.homeY).toBeGreaterThanOrEqual(roomy.minY)
    expect(roomy.minY).toBeGreaterThanOrEqual(60)

    // A frame that cannot fit the clearance must clamp to the floor, not go
    // negative or push the orb off-screen.
    const tiny = orbBounds({ width: 320, height: 200, insetTop: 20, insetBottom: 0, bottomClearance: TAB_BAR })
    expect(tiny.maxY).toBe(tiny.minY)
    expect(tiny.homeY).toBe(60)
  })

  it('writes the orb a name the web app also uses', () => {
    // One control, one name, across platforms; the web side asserts the same
    // string from its own identity module.
    expect(mica.a11y.orb.startsWith('Mica assistant')).toBe(true)
  })

  it('agrees with the web orb on the state vocabulary', () => {
    expect([...mica.states]).toEqual(['idle', 'listening', 'thinking', 'responding', 'error'])
  })
})
