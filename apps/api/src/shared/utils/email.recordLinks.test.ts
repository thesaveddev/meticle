import { describe, it, expect, beforeAll, vi } from 'vitest'
import { micaRecordUrl } from '@meticle/shared'

/**
 * The record links in email — the half of the link contract that has to be absolute.
 *
 * Why these are not just "the CTA is present" assertions. A record link is one string
 * with two ends, and email is the end where a mistake is invisible: the recipient sees
 * a button, taps it, and lands somewhere plausible but wrong — the leave page instead
 * of their leave request, the rota grid instead of the shift. So every case below
 * compares the button's `href` against the *contract's own* URL for that record
 * (`micaRecordUrl`), which is the same string the client, the bell and chat use, rather
 * than against a copy of the path written out here.
 *
 * The second half of each case is the fallback: an email a caller has not been taught to
 * link keeps the page-level button it always had. That is the property that lets this
 * change ship to eighteen templates without any of them losing a working button.
 *
 * The queue is stubbed rather than the transport: these methods enqueue (`sendMail`),
 * they never dial SMTP, so capturing what they enqueued is reading their real output.
 */
vi.mock('./email.queue', () => ({
  EmailQueue: {
    enqueue: vi.fn(async () => ({ rows: [{ id: 'queued-in-test' }] })),
    stopProcessor: vi.fn(),
  },
}))

import { EmailService } from './email.service'

const BASE = 'https://app.example.com'
const LINK = `${BASE}/tasks?task=t1`

beforeAll(() => {
  process.env.FRONTEND_URL = BASE
})

/** The HTML of the most recent enqueue, whatever the method under test enqueued. */
async function htmlFrom(run: () => Promise<void>): Promise<string> {
  const { EmailQueue } = await import('./email.queue')
  const enqueue = (EmailQueue as any).enqueue
  enqueue.mockClear()
  await run()
  const calls = enqueue.mock.calls
  expect(calls.length, 'nothing was enqueued').toBeGreaterThan(0)
  // enqueue(to, subject, html, from, attachments, options)
  return calls[calls.length - 1][2] as string
}

/**
 * Every record email: the method, the label of its record button, and the page-level
 * URL it falls back to when no record link is handed over.
 */
const RECORD_EMAILS: {
  name: string
  label: string
  fallback: string
  run: (link?: string) => Promise<void>
}[] = [
  { name: 'leave requested', label: 'Open the leave request', fallback: '/leave', run: (l) => EmailService.sendLeaveRequestedEmail('a@b.c', 'Rita', 'Sam', 'Annual', '1 May', '2 May', l) },
  { name: 'leave approved', label: 'Open the leave request', fallback: '/leave', run: (l) => EmailService.sendLeaveApprovedEmail('a@b.c', 'Sam', 'Annual', '1 May', '2 May', l) },
  { name: 'leave booked', label: 'Open the leave request', fallback: '/leave', run: (l) => EmailService.sendLeaveBookedEmail('a@b.c', 'Sam', 'Rita', 'Annual', '1 May', '2 May', l) },
  { name: 'leave rejected', label: 'Open the leave request', fallback: '/leave', run: (l) => EmailService.sendLeaveRejectedEmail('a@b.c', 'Sam', 'Annual', '1 May', '2 May', l) },
  { name: 'incident reported', label: 'Open the incident', fallback: '/incidents', run: (l) => EmailService.sendIncidentReportedEmail('a@b.c', 'Mo', 'Sam', 'Elsie', 'Morning', 'Fell', l) },
  { name: 'document expiring', label: 'Open the document', fallback: '/compliance/identity', run: (l) => EmailService.sendDocumentExpiringEmail('a@b.c', 'Sam', 'DBS', '1 May', l) },
  { name: 'document expired', label: 'Open the document', fallback: '/compliance/identity', run: (l) => EmailService.sendDocumentExpiredEmail('a@b.c', 'Sam', 'DBS', l) },
  { name: 'training expiring', label: 'Open the training record', fallback: '/compliance/training', run: (l) => EmailService.sendTrainingExpiringEmail('a@b.c', 'Sam', 'Fire Safety', '1 May', l) },
  { name: 'training expired', label: 'Open the training record', fallback: '/compliance/training', run: (l) => EmailService.sendTrainingExpiredEmail('a@b.c', 'Sam', 'Fire Safety', l) },
  { name: 'competency due', label: 'Open the assessment', fallback: '/compliance/competency', run: (l) => EmailService.sendCompetencyDueEmail('a@b.c', 'Sam', 'Medication', '1 May', false, l) },
  { name: 'overtime claimed', label: 'Open the overtime claim', fallback: '/scheduling/overtime-claims', run: (l) => EmailService.sendOvertimeClaimedEmail('a@b.c', 'Sam', 'Oak House', '1 May', '20:00', l) },
  { name: 'overtime approved', label: 'Open the overtime claim', fallback: '/scheduling', run: (l) => EmailService.sendOvertimeApprovedEmail('a@b.c', 'Sam', 'Oak House', '1 May', '20:00', l) },
  { name: 'overtime rejected', label: 'Open the overtime claim', fallback: '/shift-marketplace', run: (l) => EmailService.sendOvertimeRejectedEmail('a@b.c', 'Sam', 'Oak House', '1 May', '20:00', l) },
  { name: 'swap requested', label: 'Open the swap request', fallback: '/scheduling', run: (l) => EmailService.sendSwapRequestedEmail('a@b.c', 'Sam', 'Rita', '1 May', '07:00', l) },
  { name: 'swap accepted', label: 'Open the swap request', fallback: '/scheduling', run: (l) => EmailService.sendSwapAcceptedEmail('a@b.c', 'Sam', 'Rita', '1 May', '07:00', 'Oak House', undefined, undefined, undefined, l) },
  { name: 'swap declined', label: 'Open the swap request', fallback: '/scheduling', run: (l) => EmailService.sendSwapDeclinedEmail('a@b.c', 'Sam', 'Rita', '1 May', '07:00', l) },
  { name: 'swap accepted to manager', label: 'Open the swap request', fallback: '/scheduling', run: (l) => EmailService.sendSwapAcceptedToManagerEmail('a@b.c', 'Mo', 'Rita', 'Sam', 'Oak House', '1 May', '07:00', undefined, undefined, undefined, l) },
  { name: 'unclaimed shift', label: 'Open the shift', fallback: '/scheduling/overtime-claims', run: (l) => EmailService.sendUnclaimedShiftReminderEmail('a@b.c', 'Mo', 'Oak House', '1 May', '07:00', 'Day', l) },
]

describe('record links in email', () => {
  it('builds a record URL from the contract and the configured origin', () => {
    const ref = { kind: 'task', id: 't1' } as const
    // The same string the client, the bell and chat use — only the origin differs.
    expect(EmailService.recordUrl(ref)).toBe(micaRecordUrl(ref, BASE))
    expect(EmailService.recordUrl(ref)).toBe(LINK)
    // A care note carries its person, which is what makes the link land on the note.
    expect(EmailService.recordUrl({ kind: 'care-note', id: 'n1', personId: 'p1' })).toBe(
      `${BASE}/people/p1?tab=daily-notes&source=n1`,
    )
    expect(EmailService.recordUrl({ kind: 'incident', id: 'i1' })).toBe(`${BASE}/incidents/i1`)
  })

  for (const email of RECORD_EMAILS) {
    it(`puts the record in the button of the ${email.name} email, and keeps its page button without one`, async () => {
      const withLink = await htmlFrom(() => email.run(LINK))
      expect(withLink, `${email.name}: no button to the record`).toContain(`href="${LINK}"`)
      expect(withLink, `${email.name}: button is not named for the record`).toContain(email.label)

      const withoutLink = await htmlFrom(() => email.run())
      expect(withoutLink, `${email.name}: lost its page button`).toContain(email.fallback)
      // Nothing invents a record link: the record URL only ever comes from the caller.
      expect(withoutLink, `${email.name}: invented a link`).not.toContain('href="/')
    })
  }

  it('names the task, its priority and its due date, and always carries the link', async () => {
    const html = await htmlFrom(() =>
      EmailService.sendTaskAssignedEmail('a@b.c', 'Sam', { title: 'Check fire doors', priority: 'high', dueDate: '2026-10-20' }, LINK),
    )
    expect(html).toContain('Check fire doors')
    expect(html).toContain('high')
    expect(html).toContain('20 October')
    expect(html).toContain(`href="${LINK}"`)
    expect(html).toContain('Open the task')

    // A task with no due date says so by omission rather than by printing a blank.
    const undated = await htmlFrom(() =>
      EmailService.sendTaskAssignedEmail('a@b.c', 'Sam', { title: 'Restock kit', priority: 'low' }, LINK),
    )
    expect(undated).toContain('Restock kit')
    expect(undated).not.toMatch(/due on/i)
  })

  it('escapes a task title, because it is user input in an HTML email', async () => {
    const html = await htmlFrom(() =>
      EmailService.sendTaskAssignedEmail('a@b.c', 'Sam', { title: '<script>alert(1)</script>', priority: 'low' }, LINK),
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('links the shift preview email\'s own rows: shifts to their week, appointments to their record', async () => {
    const html = await htmlFrom(() =>
      EmailService.sendShiftStartEmail(
        'a@b.c',
        'Sam',
        '2026-10-12',
        [{ id: 'sh1', shift_type: 'day', start_time: '2026-10-12T07:00:00.000Z', end_time: '2026-10-12T19:00:00.000Z', location_name: 'Oak House' }],
        [],
        [],
        [{ id: 'a1', title: 'Podiatry clinic', start_time: '2026-10-12T13:00:00.000Z', first_name: 'Elsie', last_name: 'Fletcher' }],
      ),
    )
    // A shift is opened on the week grid, so the link names the shift and its own day —
    // which is what makes a night shift that began yesterday still findable.
    expect(html).toContain(`href="${BASE}/scheduling?week=2026-10-12&shift=sh1"`)
    expect(html).toContain(`href="${BASE}/appointments?appointment=a1"`)
    expect(html).toContain('Podiatry clinic')
  })
})
