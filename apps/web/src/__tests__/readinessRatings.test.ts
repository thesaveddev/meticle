/**
 * The readiness page must not print a rating a regulator never issued.
 *
 * `getRating` used to fall back to CQC's words — "Good", "Requires
 * Improvement", "Inadequate" — whenever a framework supplied no ratings of its
 * own. Wales was fine by accident (it had ratings, just the wrong ones).
 * Northern Ireland was not: it had no published scale, so a NI provider was
 * shown "Inadequate" on a scale RQIA has never issued.
 *
 * CIW is the other case: it publishes four ratings and says in terms that it
 * does not award one for the service as a whole. So the overall panel shows the
 * number and withholds the word.
 *
 * These read the source rather than rendering, because the failure is a control
 * flow decision — whether a label is rendered at all — and asserting on the
 * rendered tree of this page would need the whole data-fetching stack mocked to
 * say less.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = readFileSync(
  join(process.cwd(), 'src/pages/compliance/CqcReadinessPage.tsx'),
  'utf8',
)

/** Source with comments removed, so a mention in prose is not a match. */
function code(): string {
  return PAGE
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

describe('the rating helper asserts nothing it cannot source', () => {
  it('returns null when a framework publishes no ratings', () => {
    const body = /function getRating\([\s\S]*?\n\}/.exec(code())![0]
    // A fallback band here is the bug. It must return null and stop.
    expect(body).toMatch(/return null/)
    expect(body).not.toMatch(/label:\s*'Good'/)
    expect(body).not.toMatch(/label:\s*'Inadequate'/)
    expect(body).not.toMatch(/label:\s*'Requires Improvement'/)
  })

  it('separates the bar colour from the rating word', () => {
    // Colouring a bar is display; printing a regulator's word is a claim. They
    // have to be different functions or the fallback creeps back.
    expect(code()).toMatch(/function scoreColor\(/)
    expect(code()).toMatch(/if \(rating\?\.color\) return rating\.color/)
  })
})

describe('the overall panel withholds a band that does not exist', () => {
  it('gates the rating word on the regulator publishing one', () => {
    const src = code()
    expect(src).toMatch(/canShowOverallRating/)
    expect(src).toMatch(/publishesOverallRating !== false/)
    // The word is only printed inside the guarded branch.
    expect(src).toMatch(/canShowOverallRating \? \(/)
  })

  it('says which of the two reasons applies, rather than showing nothing', () => {
    const src = code()
    expect(src).toContain('Rated per theme, not overall')
    expect(src).toContain('This regulator publishes no numeric rating')
    // RQIA in particular must be told why there is no word.
    expect(src).toContain('publishes narrative inspection reports')
  })

  it('shows the score and the domain ratings', () => {
    // The percentage is ours and stays; only the word is withheld.
    expect(code()).toMatch(/\{data\.overall\}%/)
  })
})

describe('the page is not hardcoded to one regulator', () => {
  it('uses each regulator’s own name for its domains', () => {
    const src = code()
    // "Key Questions — Domain Scores" was CQC's vocabulary on every screen.
    expect(src).toMatch(/cqc' \? 'Key Questions'/)
    expect(src).toMatch(/ciw' \? 'Themes'/)
    expect(src).not.toMatch(/<Key Questions — Domain Scores>/)
  })

  it('surfaces the not-applicable themes and the ratings note', () => {
    const src = code()
    expect(src).toContain('data.notApplicableDomains')
    expect(src).toContain('data.framework?.ratingsNote')
  })

  it('confines rating dereferences to the helpers that handle null', () => {
    const src = code()
    // The only `rating.color` in the file is the guarded read inside
    // scoreColor. Anywhere else it would throw for a framework with no
    // published ratings, which is exactly the RQIA case.
    const colorReads = src.match(/rating\.color/g) || []
    expect(colorReads.length).toBeLessThanOrEqual(1)
    expect(src).toMatch(/if \(rating\?\.color\) return rating\.color/)

    // And no unguarded non-null assertion on the overall rating.
    expect(src).not.toMatch(/rating!\.color/)
    expect(src).not.toMatch(/\{rating\.label\}/)
  })
})

describe('the learning content no longer teaches the old framework facts', () => {
  const learn = readFileSync(join(process.cwd(), 'src/data/learn-content.ts'), 'utf8')

  it('does not say Wales uses the same domain structure as CQC', () => {
    expect(learn).not.toContain('CIW (Wales):</strong> Same domain structure')
  })

  it('does not list the old Welsh ratings', () => {
    // "Adequate" and "Poor" are not CIW ratings. The fourth band is "requires
    // significant improvement", which is materially more serious than "poor".
    expect(learn).not.toMatch(/Adequate, Poor/)
  })

  it('does not claim RQIA has five domains and a three-band scale', () => {
    expect(learn).not.toContain('RQIA (Northern Ireland):</strong> 5 domains')
    expect(learn).not.toContain('Mostly Compliant')
    expect(learn).not.toContain('Not Compliant')
  })

  it('states what is the regulator’s and what is ours', () => {
    expect(learn).toContain('What we own and what is theirs')
    expect(learn).toContain('Requires significant improvement')
    expect(learn).toContain('1 April 2025')
  })
})
