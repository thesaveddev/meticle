/**
 * The evidence pack must be laid out against the provider's own regulator.
 *
 * The pack used to be one document for everybody — the same sections in the same
 * order whatever country the provider was in — which is the shape of our
 * database rather than the shape of any inspection. These tests pin the three
 * behaviours that fix that, and they are written to fail for the *reason* the
 * old code failed rather than to match its output.
 */
import { describe, it, expect } from 'vitest'
import { buildEvidencePackHtml, resolveFrameworkName } from './compliance.pdf'
import { resolveRqiaStandardsSet } from '../cqc/frameworks'

/** Just enough evidence for every section to render. */
const PACK = {
  staff: [{ id: '1', first_name: 'Ada', last_name: 'Byron', email: 'ada@example.com', compliance_profile: 'Standard', compliance_rate: 90 }],
  people: [{ id: '1', first_name: 'Mary', last_name: 'Seacole', room_number: '2', status: 'active', active_care_plans: 1, open_risks: 0, total_goals: 2 }],
  care_plans: [{ id: '1', first_name: 'Mary', last_name: 'Seacole', title: 'Personal care', category: 'daily_living', status: 'active', review_date: '2026-10-01' }],
  incidents: [{ id: '1', title: 'Fall', involved_people: 'Mary Seacole', severity: 'low', status: 'closed', incident_date: '2026-09-01' }],
  training: [{ id: '1', first_name: 'Ada', last_name: 'Byron', module_name: 'Fire safety', module_category: 'safety', status: 'completed', completed_at: '2026-08-01' }],
  documents: [{ id: '1', first_name: 'Ada', last_name: 'Byron', type: 'DBS', status: 'approved', expiry_date: '2027-08-01' }],
  competency: [{ id: '1', first_name: 'Ada', last_name: 'Byron', template_name: 'Moving and handling', passed: true, assessor_first: 'Grace', assessor_last: 'Hopper', assessed_at: '2026-08-15' }],
  satisfaction: { avg_rating: '4.5', total: 10, positive: 8 },
  nutrition: [{ id: '1', person_name: 'Mary Seacole', dietary_type: 'Vegetarian', texture_modified: 'None', appetite_level: 'Good', meals_last_7d: 21, refused_last_7d: 0, avg_consumed_7d: 88, total_fluid_7d: 1400, fluid_daily_target_ml: 2000, other_allergies: null }],
  summary: { total_staff: 1, total_people: 1, active_people: 1, training_records: 1, documents: 1, competency_records: 1, incidents: 1, people_with_dietary_profiles: 1, people_with_nutrition_concerns: 0, satisfaction_avg: '4.5' },
}

const ciw = buildEvidencePackHtml(PACK, 'Hafod Care', 'ciw', 'residential')
const rqia = buildEvidencePackHtml(PACK, 'Lagan Care', 'rqia', 'residential')
const rqiaNoSetting = buildEvidencePackHtml(PACK, 'Lagan Care', 'rqia', null)
const england = buildEvidencePackHtml(PACK, 'Thames Care', 'cqc', 'residential')

describe('the pack is laid out in the regulator’s own framework', () => {
  it('gives a Welsh provider CIW’s four themes, not England’s five key questions', () => {
    // Matched case-insensitively: gov.wales writes "Care and Support" and the
    // registry's display label is "Care and support". The substance is that the
    // Welsh theme is present at all.
    for (const theme of ['well-being', 'care and support', 'leadership and management', 'environment']) {
      expect(ciw, `CIW theme "${theme}" missing from the Welsh pack`).toMatch(new RegExp(theme, 'i'))
    }
    // England-only headings. A Welsh provider shown these cannot tell what is wrong.
    expect(ciw).not.toContain('Responsive')
    expect(ciw).not.toMatch(/Key Questions/i)
  })

  it('shows CIW’s ratings, in CIW’s words, and discloses the thresholds are ours', () => {
    for (const rating of ['Excellent', 'Good', 'Requires improvement', 'Requires significant improvement']) {
      expect(ciw, `CIW rating "${rating}" missing`).toContain(rating)
    }
    // "Poor" and "adequate" are the plausible-sounding wrong answers here.
    expect(ciw).not.toMatch(/>\s*(Poor|Adequate)\s*</)
    // CIW publishes no numeric cut-offs, so the percentages must be disclosed.
    expect(ciw).toMatch(/our own mapping|are ours/i)
  })

  it('cites the framework it is arranged against, with a link and a date', () => {
    expect(ciw).toContain('gov.wales')
    expect(ciw).toContain('2025-03-28')
    expect(ciw).toContain('Checked 2026-09-30')
  })

  it('omits CIW’s Environment theme for a domiciliary provider, as CIW does', () => {
    // CIW does not rate Environment for domiciliary services. Printing it at a
    // domiciliary provider would be showing a theme its regulator never scores.
    const domiciliary = buildEvidencePackHtml(PACK, 'Hafod Care', 'ciw', 'domiciliary')
    expect(domiciliary).not.toContain('<h2 class="theme">Environment</h2>')
    // ...and it is not silently dropped either.
    expect(domiciliary).toContain('Well-being')
  })

  it('says outright that Environment is empty rather than leaving it blank', () => {
    // The honest move: CIW rates it, we hold no premises data, so say so.
    expect(ciw).toMatch(/Nothing in this product speaks to this theme/)
  })
})

describe('Northern Ireland is not given England’s or Wales’s framework', () => {
  it('never mentions CQC, whatever the provider looks like', () => {
    expect(rqia).not.toContain('Care Quality Commission')
    expect(rqia).not.toContain('Key Question')
    // Including inside the citation and the footer badge.
    expect(rqia).not.toMatch(/CQC/)
  })

  it('names the Order by its real title', () => {
    expect(rqia).toContain('Health and Personal Social Services')
    expect(rqia).not.toContain('Personal Care Services')
  })

  it('names the applicable standards document, and says how it chose it', () => {
    expect(rqia).toContain('Residential Care Home Minimum Standards')
    expect(rqia).toMatch(/inferred from your recorded service type/i)
  })

  it('refuses to guess between the nine published sets when no setting is recorded', () => {
    // Picking one of nine is a guess about the document a provider is most
    // likely to be checked against.
    expect(rqiaNoSetting).toMatch(/No service type is recorded/i)
    for (const set of ['Residential Care Home Minimum Standards', 'Care Standards for Nursing Homes']) {
      expect(rqiaNoSetting).not.toMatch(new RegExp(`inferred from your recorded service type[^]*${set}`))
    }
  })

  it('shows no rating band, because RQIA publishes no rating', () => {
    expect(rqia).toMatch(/No rating is shown for this service/)
  })

  it('states there is no single RQIA framework, so a reader is not misled', () => {
    expect(rqia).toMatch(/nine/i)
    expect(rqia).toMatch(/no single RQIA framework/i)
  })

  it('labels its groupings as ours rather than as RQIA wording', () => {
    expect(rqia).toContain('Safety and protection')
    expect(rqia).not.toMatch(/Is care safe\?/)
    expect(rqia).toMatch(/Meticle Care’s wording, not the regulator’s/)
  })
})

describe('an unknown or unrecorded regulator produces no framework at all', () => {
  it('does not fall back to the CQC', () => {
    // `getFramework` in cqc/frameworks.ts falls back to the CQC, which is right
    // for the readiness screen and catastrophic for a printable document.
    const unknown = buildEvidencePackHtml(PACK, 'Somewhere Care', 'nope', 'residential')
    expect(unknown).not.toContain('Care Quality Commission')
    expect(unknown).toMatch(/No framework recorded/i)
    expect(unknown).toMatch(/not laid out against any regulatory framework/i)
  })

  it('says so when no regulator is recorded at all', () => {
    const none = buildEvidencePackHtml(PACK, 'Somewhere Care', null, null)
    expect(resolveFrameworkName(null)).toBe('Not recorded')
    expect(none).toContain('Not recorded')
    expect(none).toMatch(/No framework recorded/i)
  })
})

describe('the pack escapes what it prints', () => {
  it('does not pass a person’s name through as markup', () => {
    const hostile = structuredClone(PACK) as any
    hostile.people[0].first_name = '<img src=x onerror=alert(1)>'
    const html = buildEvidencePackHtml(hostile, 'Sneaky & Co <b>Care</b>', 'ciw', 'residential')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
    // An ampersand in a provider's name used to be able to truncate the render.
    expect(html).toContain('Sneaky &amp; Co')
  })

  it('escapes a care plan title containing a closing tag', () => {
    const hostile = structuredClone(PACK) as any
    hostile.care_plans[0].title = '</td></tr><script>alert(1)</script>'
    const html = buildEvidencePackHtml(hostile, 'Hafod Care', 'ciw', 'residential')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('the settings resolver behaves honestly', () => {
  it('returns null rather than a default when there is nothing to go on', () => {
    expect(resolveRqiaStandardsSet(null)).toBeNull()
    expect(resolveRqiaStandardsSet('')).toBeNull()
  })

  it('routes each recorded service type to the set that governs it', () => {
    expect(resolveRqiaStandardsSet('domiciliary')?.standards).toContain('Domiciliary')
    for (const t of ['residential', 'live_in', 'supported_living']) {
      expect(resolveRqiaStandardsSet(t)?.standards).toContain('Residential Care Home')
    }
  })
})
