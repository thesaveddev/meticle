import React from 'react'
import { render, within } from '@testing-library/react-native'
import { TodayScreen } from '../TodayScreen'
import { IconAlert, IconCheck, IconClock } from '../../components/Icons'
import { radii } from '../../theme'
import type { HomecareVisit, MobileUser } from '../../types'

const user: MobileUser = {
  id: 'user-1',
  email: 'carer@example.com',
  role: 'CARE_WORKER',
  first_name: 'Test',
  last_name: 'Carer',
}

const PAST_START = '2020-01-01T09:00:00.000Z'
const PAST_END = '2020-01-01T10:00:00.000Z'
const FUTURE_START = '2030-01-01T09:00:00.000Z'
const FUTURE_END = '2030-01-01T10:00:00.000Z'

function makeVisit(id: string, status: HomecareVisit['status'], start: string, end: string): HomecareVisit {
  return {
    id,
    label: `Call ${id}`,
    visit_type: 'homecare',
    status,
    scheduled_start: start,
    scheduled_end: end,
    person_name: 'Margaret',
  }
}

function renderToday(visits: HomecareVisit[]) {
  return render(
    <TodayScreen
      user={user}
      visits={visits}
      queue={[]}
      onVisit={jest.fn()}
      onRefresh={jest.fn()}
      refreshing={false}
      onSync={jest.fn()}
    />
  )
}

describe('TodayScreen timeline status pill', () => {
  it('labels every status in words rather than the raw record value', () => {
    const screen = renderToday([
      makeVisit('v1', 'completed', PAST_START, PAST_END),
      makeVisit('v2', 'checked_in', FUTURE_START, FUTURE_END),
      makeVisit('v3', 'missed', PAST_START, PAST_END),
      makeVisit('v4', 'scheduled', FUTURE_START, FUTURE_END),
    ])

    expect(screen.getByText('Completed')).toBeTruthy()
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByText('Missed')).toBeTruthy()
    expect(screen.getByText('Scheduled')).toBeTruthy()
    expect(screen.queryByText('checked_in')).toBeNull()
  })

  it('renders the pill in the app pill shape with a matching status icon', () => {
    const screen = renderToday([
      makeVisit('v1', 'completed', PAST_START, PAST_END),
      makeVisit('v2', 'missed', PAST_START, PAST_END),
    ])

    // React Native's Text and View are composites over host nodes, so the pill is
    // the nearest host View above the label.
    const pillFor = (label: string) => {
      let node = screen.getByText(label).parent
      while (node && node.type !== 'View') node = node.parent
      expect(node).not.toBeNull()
      return node!
    }

    const completed = pillFor('Completed')
    expect(completed).toHaveStyle({ borderWidth: 1, borderRadius: radii.full })
    expect(within(completed).UNSAFE_queryByType(IconCheck)).not.toBeNull()

    const missed = pillFor('Missed')
    expect(within(missed).UNSAFE_queryByType(IconAlert)).not.toBeNull()
    expect(within(missed).UNSAFE_queryByType(IconClock)).toBeNull()
  })
})
