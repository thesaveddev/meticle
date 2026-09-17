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
  getMedicationsForPerson: jest.fn(async () => [{ id: 'mar-1', title: 'September MAR', status: 'active', items: [{ id: 'med-1', name: 'Medicine', dosage: '10', unit: 'mg', frequency: 'Daily', is_active: true }] }]),
  logMedicationAdministration: jest.fn(async () => ({ id: 'admin-1', status: 'given' })),
  getBodyMapStats: jest.fn(async () => null),
  getDailySummary: jest.fn(async () => null),
  getPersonAssessments: jest.fn(async () => [{ id: 'assessment-1', assessment_type: 'Initial assessment', assessment_date: '2026-09-01', findings: 'Requires person-centred support' }]),
  getPersonTimeline: jest.fn(async () => []),
  getPersonDocuments: jest.fn(async () => [{ id: 'doc-1', title: 'Support plan', document_type: 'Care document', file_url: '/files/private/support-plan.pdf', file_name: 'support-plan.pdf', upload_date: '2026-09-02' }]),
  getApiFileUrl: jest.fn((url: string) => `https://meticlecare.com${url}`),
  downloadPersonDocument: jest.fn(async () => ({ uri: 'file:///cache/support-plan.pdf' })),
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
const domiciliarySession: AuthSession = { ...session, organization: { service_types: ['domiciliary'] } }

describe('ClientDetailScreen', () => {
  beforeEach(() => jest.clearAllMocks())
  it('keeps domiciliary notes out of the client record and exposes care records', async () => {
    const onOpenSection = jest.fn()
    const screen = render(<ClientDetailScreen personId="person-1" session={session} onBack={jest.fn()} onOpenSection={onOpenSection} />)

    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeTruthy())
    expect(screen.getByText('Care Plans')).toBeTruthy()
    expect(screen.queryByText('Personal care')).toBeNull()
    expect(screen.queryByText('Notes')).toBeNull()

    fireEvent.press(screen.getByText('Care Plans'))
    expect(onOpenSection).toHaveBeenCalledWith('person-1', 'care')

    const carePage = render(<ClientDetailScreen personId="person-1" session={session} onBack={jest.fn()} initialTab="care" sectionOnly />)
    await waitFor(() => expect(carePage.getByText('Personal care')).toBeTruthy())
    expect(carePage.getAllByText('Care Plans').length).toBeGreaterThan(0)
    expect(carePage.queryByText('Read-only client records. Use the web app for clinical updates and document management.')).toBeNull()
    expect((api.getPersonDocuments as jest.Mock)).toHaveBeenCalledWith('token', 'person-1')
  })

  it('hides the clinical MAR tab and does not request medication data for domiciliary care', async () => {
    const screen = render(<ClientDetailScreen personId="person-1" session={domiciliarySession} onBack={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeTruthy())
    expect(screen.queryByText('Meds')).toBeNull()
    expect(api.getMedicationsForPerson).not.toHaveBeenCalled()
    const recordsPage = render(<ClientDetailScreen personId="person-1" session={domiciliarySession} onBack={jest.fn()} initialTab="records" sectionOnly />)
    await waitFor(() => expect(recordsPage.getByText('Read-only client records. Use the web app for clinical updates and document management.')).toBeTruthy())
  })

})
