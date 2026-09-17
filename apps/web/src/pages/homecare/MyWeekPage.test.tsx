import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyWeekPage from './MyWeekPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MyWeekPage', () => {
  it('shows an actionable error when the week cannot be loaded', async () => {
    mockedApi.get.mockRejectedValue(new Error('Network unavailable'))
    render(<MyWeekPage />)
    expect(await screen.findByText('Could not load your week. Please try again.')).toBeInTheDocument()
  })
})
