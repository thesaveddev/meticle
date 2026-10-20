import { linkPath, notificationAction, notificationTarget, resolveTab } from '../notificationLinks'

describe('notificationTarget', () => {
  it('opens the tab that shows the record the server linked to', () => {
    expect(notificationTarget('/chat')).toEqual({ kind: 'tab', tab: 'chat' })
    expect(notificationTarget('/settings')).toEqual({ kind: 'tab', tab: 'settings' })
    expect(notificationTarget('/mileage')).toEqual({ kind: 'tab', tab: 'mileage' })
  })

  it('opens one shift\'s handover when the link names that shift', () => {
    // The API's own shape: `/scheduling?week=2026-10-16&shift=<uuid>`. The phone has
    // a handover screen for exactly that record, so it is not a detour through the
    // week view to find the shift again.
    const shiftId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    expect(notificationTarget(`/scheduling?week=2026-10-16&shift=${shiftId}`)).toEqual({ kind: 'handover', shiftId })
    // Without a shift it is the rota, which is the week view.
    expect(notificationTarget('/scheduling?week=2026-10-16')).toEqual({ kind: 'tab', tab: 'schedule' })
    expect(notificationTarget('/my-week')).toEqual({ kind: 'tab', tab: 'schedule' })
    expect(notificationTarget('/shifts/123')).toEqual({ kind: 'notifications' })
  })

  it('falls back to the week view for a shift id it cannot use', () => {
    // A malformed id would open a handover screen that cannot load; the rota is the
    // honest destination, and it is where the shift can still be found.
    expect(notificationTarget('/scheduling?shift=')).toEqual({ kind: 'tab', tab: 'schedule' })
    expect(notificationTarget('/scheduling?shift=shift-1')).toEqual({ kind: 'tab', tab: 'schedule' })
  })

  it('opens the room-check board, which is where an overdue nudge is cleared', () => {
    // The sweep's link names the record, and the phone now has that screen: the worker
    // records the check where they are standing rather than on a computer later.
    expect(notificationTarget('/room-checks')).toEqual({ kind: 'roomChecks' })
    expect(notificationTarget('/room-checks?room=12')).toEqual({ kind: 'roomChecks' })
    expect(notificationAction('/room-checks')).toEqual({ label: 'Room checks', native: true })
  })

  it('falls back to the notifications screen for a record the phone cannot open', () => {
    // Compliance and the MAR chart are web-only screens. The message is the part of
    // the notification the phone can honestly show, so the tap lands on it rather than
    // doing nothing.
    expect(notificationTarget('/compliance')).toEqual({ kind: 'notifications' })
    expect(notificationTarget('/emedication?personId=x&month=2026-10')).toEqual({ kind: 'notifications' })
  })

  it('treats a missing or malformed link as no destination rather than guessing', () => {
    expect(notificationTarget(null)).toEqual({ kind: 'notifications' })
    expect(notificationTarget(undefined)).toEqual({ kind: 'notifications' })
    expect(notificationTarget('   ')).toEqual({ kind: 'notifications' })
    expect(notificationTarget('/chat/')).toEqual({ kind: 'tab', tab: 'chat' })
  })

  it('does not match a path that merely starts with a known one', () => {
    // A prefix match would send somebody to the rota for an unrelated record.
    expect(notificationTarget('/scheduling-archive')).toEqual({ kind: 'notifications' })
    expect(notificationTarget('/chatty')).toEqual({ kind: 'notifications' })
  })
})

describe('notificationAction', () => {
  it('names the record and admits when the phone has no screen for it', () => {
    // The row says where a tap goes before it is tapped. Room checks has a screen and
    // says so; compliance is a web page and admits it.
    expect(notificationAction('/room-checks')).toEqual({ label: 'Room checks', native: true })
    expect(notificationAction('/compliance')).toEqual({ label: 'Compliance', native: false })
    // A shift's week view is a screen this app has, which is a different promise.
    expect(notificationAction('/scheduling?week=2026-10-16')).toEqual({ label: 'the week view', native: true })
    expect(notificationAction('/scheduling?week=2026-10-16&shift=3f2504e0-4f89-41d3-9a0c-0305e82c3301'))
      .toEqual({ label: 'the shift handover', native: true })
    expect(notificationAction('/chat')).toEqual({ label: 'Chat', native: true })
  })

  it('agrees with the router about what the phone can open', () => {
    // One rule, two readings: a label that promised navigation the router would not
    // perform is exactly the drift this pairs to prevent. "Native" means any screen
    // this app has — a tab, or one shift's handover.
    for (const link of [
      '/room-checks', '/compliance', '/scheduling', '/chat', '/mileage', '/emedication',
      '/scheduling?week=2026-10-16&shift=3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    ]) {
      expect(notificationAction(link).native).toBe(notificationTarget(link).kind !== 'notifications')
    }
  })

  it('labels nothing when there is nothing to label', () => {
    expect(notificationAction(null)).toEqual({ label: '', native: false })
    expect(notificationAction('/unknown-page')).toEqual({ label: '', native: false })
  })
})

describe('resolveTab', () => {
  it('uses the requested tab when the role has it', () => {
    expect(resolveTab({ kind: 'tab', tab: 'schedule' }, ['today', 'schedule', 'chat'])).toBe('schedule')
  })

  it('falls back to the role’s first tab when it does not', () => {
    // A manager's bar has no Schedule; leaving them on a tab that is not there is a
    // screen with no way back.
    expect(resolveTab({ kind: 'tab', tab: 'schedule' }, ['today', 'clients', 'visits'])).toBe('today')
  })

  it('has no tab for a destination that is not a tab', () => {
    expect(resolveTab({ kind: 'notifications' }, ['today'])).toBeNull()
  })
})

describe('linkPath', () => {
  it('normalises a link to a bare path', () => {
    expect(linkPath('/scheduling?week=x#y')).toBe('/scheduling')
    expect(linkPath('room-checks')).toBe('/room-checks')
    expect(linkPath('/')).toBe('/')
  })
})
