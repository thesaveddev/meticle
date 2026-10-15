import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { MICA_RECORD_PARAMS, micaRecordPath, type MicaRecordKind, type MicaRecordRef } from '@meticle/shared'
import { renderMessageText, isRecordLink, recordPathInToken } from './utils'
import MessageBubble from './components/MessageBubble'
import type { ChatMessage } from './hooks/useChat'

/**
 * Record links inside a chat message.
 *
 * What this pins. A colleague shares what the app gave them — a notification's link,
 * an email's button, the path Mica read back — and chat has to open the record rather
 * than show dead text. Two halves matter and they fail differently:
 *
 *   1. The *recognition*, which is a pure function of the body text and is what most
 *      of this file asserts. A link that is not recognised is a link nobody can use;
 *      a piece of ordinary text recognised as one is a sentence that navigates.
 *   2. The *click*, which must land in the running app. An `<a href>` to one of our
 *      own routes reloads the whole client, so the last test asserts the router moved
 *      instead.
 *
 * The round-trip case is the important one: every kind in the shared contract is built
 * by `micaRecordPath`, pasted into a message, and must come back out as a record part
 * carrying exactly that path. Add a kind to the contract and this fails until chat
 * understands it.
 */

/** A ref per kind, with the ids each one takes. */
const REFS: Record<MicaRecordKind, MicaRecordRef> = {
  task: { kind: 'task', id: 't1' },
  appointment: { kind: 'appointment', id: 'a1' },
  'care-note': { kind: 'care-note', id: 'n1', personId: 'p1' },
  incident: { kind: 'incident', id: 'i1' },
  'leave-request': { kind: 'leave-request', id: 'l1' },
  'overtime-claim': { kind: 'overtime-claim', id: 'o1' },
  'swap-request': { kind: 'swap-request', id: 's1' },
  shift: { kind: 'shift', id: 'sh1', week: '2026-10-12' },
  visit: { kind: 'visit', id: 'v1', date: '2026-10-12' },
  'medication-chart': { kind: 'medication-chart', id: 'm1', personId: 'p1', month: '2026-10' },
  'staff-compliance': { kind: 'staff-compliance', id: 'c1', staffId: 'u1' },
}

const recordsIn = (text: string) =>
  renderMessageText(text).filter(part => part.type === 'record').map(part => part.value)

describe('finding a record link in a message', () => {
  it('finds a relative record path', () => {
    expect(recordsIn('sorting this tomorrow /tasks?task=abc')).toEqual(['/tasks?task=abc'])
  })

  it('finds an incident, which is the one kind the route names', () => {
    expect(recordsIn('look /incidents/9f2b')).toEqual(['/incidents/9f2b'])
  })

  it('turns an absolute link on our origin back into the in-app path', () => {
    // An email's button target, pasted into chat: the reader should land on the record
    // in the client they already have open, not in a new tab that reloads the app.
    expect(recordsIn('https://meticlecare.com/leave?request=l1')).toEqual(['/leave?request=l1'])
    expect(recordsIn('http://localhost:3000/people/p1?tab=daily-notes&source=n1')).toEqual([
      '/people/p1?tab=daily-notes&source=n1',
    ])
  })

  it('recognises every kind the shared contract can build', () => {
    for (const kind of Object.keys(REFS) as MicaRecordKind[]) {
      const path = micaRecordPath(REFS[kind])
      expect(recordsIn(`please check ${path}`), `${kind}: ${path}`).toEqual([path])
    }
    // A parameter kind added to the contract without a case here would be recognised
    // by the helper and untested by this file; this is the line that says so.
    expect(Object.keys(REFS).sort()).toEqual(
      [...Object.keys(MICA_RECORD_PARAMS), 'incident'].sort(),
    )
  })

  it('keeps the text either side of the link, and its line breaks', () => {
    const parts = renderMessageText('handover:\nsee /tasks?task=abc\nthanks')
    expect(parts).toEqual([
      { type: 'text', value: 'handover:\nsee ' },
      { type: 'record', value: '/tasks?task=abc' },
      { type: 'text', value: '\nthanks' },
    ])
  })

  it('leaves the full stop to the writer', () => {
    const parts = renderMessageText('done — see /incidents/9f2b.')
    expect(parts[parts.length - 1]).toEqual({ type: 'text', value: '.' })
    expect(recordsIn('done — see /incidents/9f2b.')).toEqual(['/incidents/9f2b'])
  })

  it('does not treat a path with no record in it as a link', () => {
    // `/tasks?task=` names no record: navigating there would open the tasks list and
    // look like the message did nothing.
    expect(isRecordLink('/tasks?task=')).toBe(false)
    expect(recordsIn('the list is at /tasks')).toEqual([])
    expect(recordsIn('/tasks?status=open')).toEqual([])
    // A parameter name the pages do not use is not a record link, whatever it looks
    // like — the list of names comes from the contract, not from this file.
    expect(isRecordLink('/leave?holiday=l1')).toBe(false)
    // Nor is a route that only shares a prefix with one.
    expect(isRecordLink('/incidents/i1/edit')).toBe(false)
  })

  it('leaves ordinary messages exactly as they were', () => {
    // The comma is what ends the mention: a mention's own name may contain spaces,
    // which is not this change's business.
    expect(renderMessageText('@Priya, can you cover the 2pm call?')).toEqual([
      { type: 'mention', value: '@Priya' },
      { type: 'text', value: ', can you cover the 2pm call?' },
    ])
    // An external URL is still an external URL, preview and all.
    expect(renderMessageText('see https://example.com/policy')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com/policy' },
    ])
    // A path that is not a record link is plain text, punctuation included.
    expect(renderMessageText('open /reports/2026')).toEqual([
      { type: 'text', value: 'open /reports/2026' },
    ])
  })

  it('drops trailing punctuation from a link at the end of a sentence', () => {
    expect(recordPathInToken('/tasks?task=abc.')).toBe('/tasks?task=abc')
    expect(recordPathInToken('/tasks?task=abc,')).toBe('/tasks?task=abc')
    expect(recordPathInToken('/tasks?task=abc')).toBe('/tasks?task=abc')
    expect(recordPathInToken('/tasks?task=')).toBeNull()
  })
})

describe('opening a record from a message', () => {
  it('hands the click to the router instead of reloading the app', () => {
    const locationText = () => window.location.pathname + window.location.search
    const before = locationText()

    function LocationProbe() {
      const location = useLocation()
      return <span data-testid="location">{location.pathname + location.search}</span>
    }

    const noop = vi.fn()
    const message = {
      id: 'm1',
      content: 'grip rails ordered — /tasks?task=abc',
      created_at: new Date().toISOString(),
      sender_id: 'u1',
      first_name: 'Ada',
      last_name: 'Nwosu',
      // Only the fields this bubble reads are set; the rest of `ChatMessage` is the
      // server's, and inventing it here would pin shapes this test does not exercise.
    } as unknown as ChatMessage

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <MessageBubble
          msg={message}
          isMine={false}
          showAvatar={false}
          seen={false}
          seenBy=""
          editingId={null}
          editText=""
          onEditTextChange={noop}
          onStartEdit={noop}
          onSaveEdit={noop}
          onCancelEdit={noop}
          onDelete={noop}
          onReact={noop}
          onOpenReactionPicker={noop}
          onOpenFile={noop}
          onReply={noop}
          user={{ first_name: 'Ada' }}
          channelType="dm"
          otherLastRead={null}
          memberReads={[]}
        />
        <LocationProbe />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: '/tasks?task=abc' })
    expect(link.getAttribute('href')).toBe('/tasks?task=abc')
    fireEvent.click(link)

    expect(screen.getByTestId('location').textContent).toBe('/tasks?task=abc')
    // The client was not reloaded: jsdom's own location is where it was.
    expect(locationText()).toBe(before)
  })
})
