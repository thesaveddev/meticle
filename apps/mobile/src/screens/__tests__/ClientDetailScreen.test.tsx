import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { ClientDetailScreen } from '../ClientDetailScreen'
import * as api from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getPersonDetail: jest.fn(async () => ({
    id: 'person-1', first_name: 'Ada', last_name: 'Lovelace', status: 'active',
    care_plans: [{ id: 'plan-1', title: 'Personal care', category: 'Daily living', status: 'active', description: 'Support with morning routine', review_date: '2026-11-01' }],
    risk_assessments: [{ id: 'risk-1', type: 'Falls', risk_level: 'high', details: 'Needs supervision', mitigation_actions: 'Use walking aid' }],
    family_contacts: [], allergies: [],
  })),
  getMedicationsForPerson: jest.fn(async () => []),
  getBodyMapStats: jest.fn(async () => null),
  getDailySummary: jest.fn(async () => null),
  getPersonAssessments: jest.fn(async () => [{ id: 'assessment-1', assessment_type: 'Initial assessment', assessment_date: '2026-09-01', findings: 'Requires person-centred support' }]),
  getPersonTimeline: jest.fn(async () => []),
  getPersonDocuments: jest.fn(async () => [{ id: 'doc-1', title: 'Support plan', document_type: 'Care document', upload_date: '2026-09-02' }]),
  getPersonClinicalScores: jest.fn(async () => []),
  getPersonWellbeing: jest.fn(async () => []),
  getPersonCapacityAssessments: jest.fn(async () => []),
  getPersonCarePathways: jest.fn(async () => []),
  getPersonCommunicationLog: jest.fn(async () => []),
  getPersonTimeAway: jest.fn(async () => []),
}))
jest.mock('../../components/MapPickerModal', () => ({ MapPickerModal: () => null }))

const session: AuthSession = {
  accessToken: 'token', refreshToken: 'refresh',
  user: { id: 'carer-1', email: 'carer@example.com', role: 'CARE_WORKER', first_name: 'Test', last_name: 'Carer' },
}

describe('ClientDetailScreen', () => {
  it('keeps domiciliary notes out of the client record and exposes care records', async () => {
    const screen = render(<ClientDetailScreen personId="person-1" session={session} onBack={jest.fn()} />)

    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeTruthy())
    expect(screen.getByText('Care Plans')).toBeTruthy()
    expect(screen.queryByText('Notes')).toBeNull()

    fireEvent.press(screen.getByText('Care Plans'))
    expect(screen.getByText('Personal care')).toBeTruthy()
    fireEvent.press(screen.getByText('Records'))
    expect(screen.getByText('Initial assessment')).toBeTruthy()
    expect(screen.getByText('Support plan')).toBeTruthy()
    expect(screen.getByText('Read-only client records. Use the web app for clinical updates and document management.')).toBeTruthy()
    expect((api.getPersonDocuments as jest.Mock)).toHaveBeenCalledWith('token', 'person-1')
  })
})
