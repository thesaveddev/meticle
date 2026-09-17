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
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '17:00' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The end time must be after the start time.')).toBeInTheDocument()
    expect(mockedApi.post).not.toHaveBeenCalled()
  })

  it('shows a load error when availability cannot be fetched', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Availability service unavailable'))
    render(<AvailabilityPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load availability')
  })
})
