import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  MICA_RECORD_PARAMS,
  MICA_CARE_NOTE_TAB,
  MICA_STAFF_COMPLIANCE_TAB,
  micaRecordPath,
  micaRecordUrl,
  type MicaRecordKind,
  type MicaRecordRef,
} from '@meticle/shared'

/**
 * The record-link contract, and the one failure mode it cannot survive.
 *
 * A record link is one string with two ends: a server composes it (a notification, a
 * chat message, an email button, Mica's own reply) and a page reads it to open that
 * record. One end alone is a lie that looks like it worked — the link carries
 * `?request=` and the leave page goes on showing its default tab, so the carer
 * follows a link from an email and finds a list. Nothing at either end fails loudly.
 *
 * So this file holds both halves:
 *
 *   1. The shape of every link, as a literal. An id is encoded, the route is right,
 *      and a week-scoped page carries the date it needs to open where the record is.
 *   2. A scan of each target page's own source, asserting it names the parameter the
 *      link carries. This is the test that fails when somebody adds a kind to the
 *      contract and forgets the reader — which is the whole point of writing the
 *      contract down in one place.
 *
 * `incident` is the one kind that reads no parameter: the route itself names the
 * record. Its case asserts that instead.
 */

const WEB = path.resolve(__dirname, '..', '..')

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
  'family-feedback': { kind: 'family-feedback', id: 'f1' },
}

/**
 * Each kind's page, and the parameter name its link carries where it has one.
 *
 * `page` is the file whose reader decides whether the link works — one file per kind,
 * because a reader in a second file would be a second answer to the same question.
 * `param` is omitted for a kind the route itself opens.
 */
const READERS: Record<MicaRecordKind, { page: string; param?: string }> = {
  task: { page: 'src/pages/tasks/TasksPage.tsx', param: MICA_RECORD_PARAMS.task },
  appointment: { page: 'src/pages/appointments/AppointmentsPage.tsx', param: MICA_RECORD_PARAMS.appointment },
  'care-note': { page: 'src/pages/people/PersonProfilePage.tsx', param: MICA_RECORD_PARAMS['care-note'] },
  incident: { page: 'src/pages/incidents/IncidentDetailPage.tsx' },
  'leave-request': { page: 'src/pages/leave/LeaveManagerPage.tsx', param: MICA_RECORD_PARAMS['leave-request'] },
  'overtime-claim': { page: 'src/pages/scheduling/OvertimeClaimsPage.tsx', param: MICA_RECORD_PARAMS['overtime-claim'] },
  'swap-request': { page: 'src/pages/homecare/SwapTransferPage.tsx', param: MICA_RECORD_PARAMS['swap-request'] },
  shift: { page: 'src/pages/scheduling/RotaPlannerPage.tsx', param: MICA_RECORD_PARAMS.shift },
  visit: { page: 'src/pages/homecare/CallSchedulingPage.tsx', param: MICA_RECORD_PARAMS.visit },
  'medication-chart': { page: 'src/pages/emedication/EMedicationPage.tsx', param: MICA_RECORD_PARAMS['medication-chart'] },
  'staff-compliance': { page: 'src/pages/staff/StaffProfilePage.tsx', param: MICA_RECORD_PARAMS['staff-compliance'] },
  'family-feedback': { page: 'src/pages/homecare/FamilyFeedbackBoard.tsx', param: MICA_RECORD_PARAMS['family-feedback'] },
}

describe('the record link contract', () => {
  it('builds every link from the route and the parameter that page reads', () => {
    expect(micaRecordPath(REFS.task)).toBe('/tasks?task=t1')
    expect(micaRecordPath(REFS.appointment)).toBe('/appointments?appointment=a1')
    expect(micaRecordPath(REFS['care-note'])).toBe(`/people/p1?tab=${MICA_CARE_NOTE_TAB}&source=n1`)
    expect(micaRecordPath(REFS.incident)).toBe('/incidents/i1')
    expect(micaRecordPath(REFS['leave-request'])).toBe('/leave?request=l1')
    expect(micaRecordPath(REFS['overtime-claim'])).toBe('/scheduling/overtime-claims?claim=o1')
    expect(micaRecordPath(REFS['swap-request'])).toBe('/swap-transfer?swap=s1')
    // A shift is found on the week grid, so the link opens the grid that holds it.
    expect(micaRecordPath(REFS.shift)).toBe('/scheduling?week=2026-10-12&shift=sh1')
    expect(micaRecordPath(REFS.visit)).toBe('/call-scheduling/day?date=2026-10-12&visit=v1')
    expect(micaRecordPath(REFS['medication-chart'])).toBe('/emedication?personId=p1&month=2026-10')
    expect(micaRecordPath(REFS['staff-compliance'])).toBe(
      `/staff/u1?tab=${MICA_STAFF_COMPLIANCE_TAB}&record=c1`,
    )
    expect(micaRecordPath(REFS['family-feedback'])).toBe('/homecare?tab=feedback&feedback=f1')
  })

  it('encodes what it puts in a path or a query string', () => {
    expect(micaRecordPath({ kind: 'task', id: 'not a uuid' })).toBe('/tasks?task=not%20a%20uuid')
    expect(micaRecordPath({ kind: 'care-note', id: 'n 1', personId: 'p/1' })).toBe(
      `/people/p%2F1?tab=${MICA_CARE_NOTE_TAB}&source=n%201`,
    )
    // An id that would read as a second parameter if it were not encoded.
    expect(micaRecordPath({ kind: 'leave-request', id: 'x&tab=balances' })).toBe(
      '/leave?request=x%26tab%3Dbalances',
    )
  })

  it('makes an absolute link out of any base, for the places a link has to leave the app', () => {
    const ref = REFS.task
    expect(micaRecordUrl(ref, 'https://app.example.com')).toBe('https://app.example.com/tasks?task=t1')
    // A trailing slash must not produce a double slash: an email button to
    // `//tasks` is a link to a different host, not a typo.
    expect(micaRecordUrl(ref, 'https://app.example.com/')).toBe('https://app.example.com/tasks?task=t1')
    expect(micaRecordUrl(ref, 'http://localhost:3000///')).toBe('http://localhost:3000/tasks?task=t1')
  })

  it('reads every parameter it names out of the page that owns it', () => {
    for (const [kind, reader] of Object.entries(READERS) as [MicaRecordKind, (typeof READERS)[MicaRecordKind]][]) {
      const source = fs.readFileSync(path.join(WEB, reader.page), 'utf8')
      if (!reader.param) {
        // The route names the record; the page must read the route it is given.
        expect(source, `${kind}: ${reader.page} does not read a route parameter`).toMatch(
          /useParams|useParams<|\bid\b/,
        )
        continue
      }
      // It must *read* the parameter: through the contract keyed by kind (the
      // idiomatic form here), keyed by parameter name, or spelled out in a
      // `searchParams.get('...')` call. A bare mention of the word is not enough, and
      // matching the parameter name alone is not either — for `care-note`,
      // `leave-request`, `overtime-claim`, `swap-request` and `staff-compliance` the
      // parameter is a different word from the kind, so this test passed vacuously on
      // `SwapTransferPage`, which contains a stray 'swap' in a request-type union.
      const reads = new RegExp(
        `MICA_RECORD_PARAMS\\[['"]${kind}['"]\\]` +
          `|MICA_RECORD_PARAMS\\.${kind}` +
          `|MICA_RECORD_PARAMS\\[['"]${reader.param}['"]\\]` +
          `|\\.get\\(\\s*['"]${reader.param}['"]`,
      )
      expect(
        reads.test(source),
        `${kind}: ${reader.page} never reads "${reader.param}" — the link would carry it and the page would ignore it`,
      ).toBe(true)
    }
  })

  it('gives every kind a link and every link a reader', () => {
    // The two tables are keyed by the same union, so a kind can only be missing from
    // one by being missing from the type — but a kind added to the type and to
    // neither run-time table would surface here rather than as a link nobody reads.
    expect(Object.keys(REFS).sort()).toEqual(Object.keys(READERS).sort())
    for (const kind of Object.keys(REFS) as MicaRecordKind[]) {
      expect(micaRecordPath(REFS[kind]).startsWith('/'), kind).toBe(true)
    }
  })
})
