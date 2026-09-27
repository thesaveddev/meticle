import {
  CAPTURE_POINTS,
  STAFF_LOCATION_NOTICE,
  STAFF_LOCATION_NOTICE_KEY,
  STAFF_LOCATION_NOTICE_VERSION,
  needsAcknowledgement,
} from '../content/staffLocationNotice'

const allText = STAFF_LOCATION_NOTICE
  .flatMap(s => [s.heading, ...s.body, ...(s.points ?? [])])
  .join(' ')
  .toLowerCase()

/**
 * These tests are about what the notice is *not* allowed to say, as much as
 * what it does say. Every line in it is a claim about the software, and the
 * failure mode for a privacy notice is not being too short — it is being
 * confidently wrong about a worker's rights, which is worse for them than
 * saying nothing.
 */
describe('the staff location notice', () => {
  describe('the capture points it claims', () => {
    it('describes exactly three, which is what the app reads', () => {
      expect(CAPTURE_POINTS).toHaveLength(3)
    })

    it('says which one reaches the employer and that the other two do not', () => {
      const sent = CAPTURE_POINTS.filter(p => p.sent === 'sent_to_employer')
      const device = CAPTURE_POINTS.filter(p => p.sent === 'stays_on_your_phone')
      expect(sent).toHaveLength(1)
      expect(device).toHaveLength(2)
      expect(sent[0].trigger).toMatch(/check in or check out/i)
    })

    it('does not describe the transmitted point without naming the accuracy', () => {
      const sent = CAPTURE_POINTS.find(p => p.sent === 'sent_to_employer')!
      expect(sent.what).toMatch(/accurate/i)
    })

    it('carries a code reference on every point, so it can be re-checked', () => {
      for (const point of CAPTURE_POINTS) {
        expect(point.evidence.length).toBeGreaterThan(20)
      }
    })
  })

  describe('claims it must not make', () => {
    it('states no retention period, because none has been decided', () => {
      // The DPIA escalated this to the DPO rather than guessing, and v1.0 of
      // that document asserted an unevidenced "recommended 8 years". A number
      // here would be the same error wearing different clothes.
      expect(allText).not.toMatch(/\b\d+\s*(year|month|week|day)s?\b/)
      expect(allText).not.toMatch(/retain(ed)?\s+for\s+\d+/)
    })

    it('does not claim the worker consented', () => {
      // MeticleCare is a processor and cannot give a worker a lawful basis for
      // their employer's monitoring. Saying "you consented" would be the app
      // manufacturing an agreement it has no standing to create.
      expect(allText).not.toMatch(/\byou (have )?consented\b/)
      expect(allText).not.toMatch(/\bconsent(ed|ed to)\b/)
    })

    it('does not promise the app is not a lone-worker safety system', () => {
      // It is not one, and a worker reading a location notice is exactly the
      // person who might assume otherwise.
      expect(allText).not.toMatch(/lone.?worker/)
    })

    it('does not claim any encryption or certification we have not evidenced', () => {
      expect(allText).not.toMatch(/iso 27001|cyber essentials|penetration.?tested/)
    })

    it('does not describe the map as live or real-time', () => {
      // Narrower than a bare "live" match, because the notice *does* contain
      // the phrase "do not see a live feed" — a denial, which is the sentence
      // we want. What must not appear is the old product name or a claim of
      // real-time, not the word.
      expect(allText).not.toMatch(/the live map/)
      expect(allText).not.toMatch(/real.?time/)
      expect(allText).toMatch(/do not see a live feed/i)
      expect(allText).toMatch(/not where you are now/i)
    })
  })

  describe('what it must tell the worker', () => {
    it('names the employer as the party that decides', () => {
      expect(allText).toMatch(/your employer is the care provider/)
      expect(allText).toMatch(/data controller|they decide/i)
    })

    it('says the employer sees the position against their name', () => {
      expect(allText).toMatch(/your name/)
      expect(allText).toMatch(/check-in map|check in map/i)
    })

    it('states the consequence of refusing the phone permission', () => {
      // The honest and unpleasant part: with location on, refusing means you
      // cannot check in, and the employer sees that you have not.
      expect(allText).toMatch(/will not be able to check in/i)
    })

    it('says what is lost if the employer switches location off', () => {
      expect(allText).toMatch(/can no longer check that you were at/i)
    })

    it('admits the app cannot show the worker what is held', () => {
      expect(allText).toMatch(/does not show you a history/i)
    })

    it('routes the objection to the employer rather than to us', () => {
      expect(allText).toMatch(/contact your employer/i)
    })

    it('says the position never reaches an AI provider', () => {
      // Verified: no coordinate column appears in any AI context query.
      expect(allText).toMatch(/never sent to an ai provider/i)
    })
  })

  describe('version gating', () => {
    const current = { notice_key: STAFF_LOCATION_NOTICE_KEY, notice_version: STAFF_LOCATION_NOTICE_VERSION }

    it('shows the notice to someone who has never read it', () => {
      expect(needsAcknowledgement(null)).toBe(true)
      expect(needsAcknowledgement(undefined)).toBe(true)
    })

    it('does not show it again to someone who has read this version', () => {
      expect(needsAcknowledgement(current)).toBe(false)
    })

    it('shows it again when the text has been revised', () => {
      expect(needsAcknowledgement({ ...current, notice_version: '0.9' })).toBe(true)
    })

    it('shows it for a different notice, whatever the version', () => {
      expect(needsAcknowledgement({ notice_key: 'something_else', notice_version: STAFF_LOCATION_NOTICE_VERSION })).toBe(true)
    })

    it('treats a null version from the server as not read', () => {
      // The API returns nulls for a worker with no record, rather than 404.
      expect(needsAcknowledgement({ notice_key: STAFF_LOCATION_NOTICE_KEY, notice_version: null })).toBe(true)
    })
  })
})
