import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvailabilityPage from './AvailabilityPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('user', JSON.stringify({ role: 'CARE_WORKER' }))
  mockedApi.get.mockResolvedValue({ data: [] })
})

describe('AvailabilityPage', () => {
  it('prevents an availability window whose end is not after its start', async () => {
    render(<AvailabilityPage />)
    expect(await screen.findByRole('heading', { name: 'My Availability' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add availability/i }))
    fireEvent.change(screen.getByLabelText('Available from'), { target: { value: '17:00' } })
    fireEvent.change(screen.getByLabelText('Available until'), { target: { value: '09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save time window' }))

    expect(await screen.findByText('The end time must be after the start time.')).toBeInTheDocument()
    expect(mockedApi.post).not.toHaveBeenCalled()
  })

  it('shows booked leave as unavailable in the schedule tab', async () => {
    const today = new Date()
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    mockedApi.get.mockImplementation(((path: string) => {
      if (path === '/homecare/my-availability') return Promise.resolve({ data: [{ id: 'a1', staff_id: 'me', day_of_week: today.getDay(), start_time: '09:00', end_time: '17:00' }] })
      if (path === '/leave/my-requests') return Promise.resolve({ data: [{ id: 'l1', staff_id: 'me', start_date: date, end_date: date, status: 'approved', leave_type_name: 'Annual leave' }] })
      return Promise.resolve({ data: [] })
    }) as any)

    render(<AvailabilityPage />)
    expect(await screen.findByRole('heading', { name: 'My Availability' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Schedule' }))

    expect(await screen.findByText('Annual leave · approved')).toBeInTheDocument()
    expect(screen.getByText('Unavailable for visits')).toBeInTheDocument()
  })

  it('shows a load error when availability cannot be fetched', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Availability service unavailable'))
    render(<AvailabilityPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load availability')
  })
})
