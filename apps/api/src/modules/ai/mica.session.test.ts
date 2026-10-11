import { describe, expect, it } from 'vitest'
import { loadOrCreateSession, recordTurn, buildFollowUpMessages, sessionCount, sweepExpiredSessions, sweepCount } from './mica.session'

/**
 * Mica's follow-up memory holds the user's own questions and the answers they
 * already heard aloud — no tool results, no pseudonym maps. These tests pin
 * the security-relevant properties: user+org scoping, TTL expiry, and the
 * message replay shape the model sees. loadOrCreateSession is now async and
 * falls back to the in-process map whenever Redis is absent (the default in
 * the vitest env), so these remain the exact guarantees that path holds.
 */
describe('mica.session', () => {
  it('issues a session id and replays prior turns as user/assistant pairs', async () => {
    const before = sessionCount()
    const s = await loadOrCreateSession('org1', 'user1')
    expect(s).toBeTruthy()
    expect(sessionCount()).toBe(before + 1)

    await recordTurn(s!, 'who is on shift today?', 'Fatima Iqbal is on the day shift.')
    await recordTurn(s!, 'what about tomorrow?', 'Nobody is rostered tomorrow yet.')

    const { messages, priorTurns } = buildFollowUpMessages(s!, 'SYS', 'and the night shift?')
    expect(priorTurns).toBe(2)
    expect(messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'who is on shift today?' },
      { role: 'assistant', content: 'Fatima Iqbal is on the day shift.' },
      { role: 'user', content: 'what about tomorrow?' },
      { role: 'assistant', content: 'Nobody is rostered tomorrow yet.' },
      { role: 'user', content: 'and the night shift?' },
    ])
  })

  it('rejects a session id belonging to another user or org, and starts fresh', async () => {
    const s = await loadOrCreateSession('org1', 'user1')
    await recordTurn(s!, 'who is on shift today?', 'Fatima Iqbal.')

    // Same id, different user → fresh session, prior turn NOT leaked.
    const s2 = await loadOrCreateSession('org1', 'user2', s!.sessionId)
    expect(s2!.sessionId).not.toBe(s!.sessionId)
    expect(buildFollowUpMessages(s2!, 'SYS', 'anything?').priorTurns).toBe(0)

    // Same id, different org → also fresh.
    const s3 = await loadOrCreateSession('org2', 'user1', s!.sessionId)
    expect(s3!.sessionId).not.toBe(s!.sessionId)
    expect(buildFollowUpMessages(s3!, 'SYS', 'anything?').priorTurns).toBe(0)

    // Same id, same user+org → same session, turns replay.
    const s4 = await loadOrCreateSession('org1', 'user1', s!.sessionId)
    expect(s4!.sessionId).toBe(s!.sessionId)
    expect(buildFollowUpMessages(s4!, 'SYS', 'and tonight?').priorTurns).toBe(1)
  })

  it('caps history at 6 turns, dropping the oldest', async () => {
    const s = await loadOrCreateSession('org1', 'user9')
    for (let i = 1; i <= 8; i++) await recordTurn(s!, `q${i}`, `a${i}`)
    const { messages, priorTurns } = buildFollowUpMessages(s!, 'SYS', 'next?')
    expect(priorTurns).toBe(6)
    expect(messages.some((m) => m.content === 'q1')).toBe(false)
    expect(messages.some((m) => m.content === 'q3')).toBe(true)
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'next?' })
  })

  it('expired sessions are reaped by the periodic sweep without any new traffic', async () => {
    const before = sessionCount()
    const s = await loadOrCreateSession('org1', 'user-sweep')
    await recordTurn(s!, 'who is on shift today?', 'Fatima Iqbal.')
    // Simulate the sliding TTL expiring: no request has to arrive — the
    // unref'd 60s interval (hooked here directly) removes it on its own.
    s!.updatedAt = Date.now() - (30 * 60 * 1000 + 1)
    const remaining = sweepExpiredSessions()
    const check = await loadOrCreateSession('org1', 'user-sweep', s!.sessionId)
    expect(remaining).toBe(before)
    expect(check!.sessionId).not.toBe(s!.sessionId)
    expect(buildFollowUpMessages(check!, 'SYS', 'still there?').priorTurns).toBe(0)
    expect(sweepCount()).toBeGreaterThan(0)
  })
})
