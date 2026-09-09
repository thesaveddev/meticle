import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import OnboardingFlow from './OnboardingFlow'

// Mock localStorage
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'test-user', role: 'ORG_ADMIN', organization_id: 'test-org' }))
})

// Mock api
vi.mock('../../services/api', () => ({
  default: {
    patch: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('OnboardingFlow', () => {
  it('renders step 1 with all four service type cards', () => {
    renderWithRouter(<OnboardingFlow />)
    
    expect(screen.getByText('What kind of care do you provide?')).toBeTruthy()
    expect(screen.getByText('Domiciliary Care')).toBeTruthy()
    expect(screen.getByText('Supported Living')).toBeTruthy()
    expect(screen.getByText('Care Home')).toBeTruthy()
    expect(screen.getByText('Live-in Care')).toBeTruthy()
  })

  it('allows multi-selecting service types', () => {
    renderWithRouter(<OnboardingFlow />)
    
    // Click domiciliary
    fireEvent.click(screen.getByText('Domiciliary Care'))
    // Click supported living
    fireEvent.click(screen.getByText('Supported Living'))
    
    // Both should be selected (Continue button should be enabled)
    const continueBtn = screen.getByText('Continue')
    expect(continueBtn).toBeTruthy()
    expect((continueBtn as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables Continue when no types selected', () => {
    renderWithRouter(<OnboardingFlow />)
    
    const continueBtn = screen.getByText('Continue')
    expect((continueBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('navigates to step 2 when Continue is clicked', () => {
    renderWithRouter(<OnboardingFlow />)
    
    // Select a type
    fireEvent.click(screen.getByText('Domiciliary Care'))
    // Click Continue
    fireEvent.click(screen.getByText('Continue'))
    
    // Should show step 2
    expect(screen.getByText('Tell us about your organisation')).toBeTruthy()
    expect(screen.getByLabelText('Organization Name')).toBeTruthy()
  })

  it('shows selected types as chips in step 2', () => {
    renderWithRouter(<OnboardingFlow />)
    
    // Select types
    fireEvent.click(screen.getByText('Domiciliary Care'))
    fireEvent.click(screen.getByText('Care Home'))
    fireEvent.click(screen.getByText('Continue'))
    
    // Should show chips for selected types
    expect(screen.getByText('Domiciliary Care')).toBeTruthy()
    expect(screen.getByText('Care Home')).toBeTruthy()
  })

  it('allows going back from step 2 to step 1', () => {
    renderWithRouter(<OnboardingFlow />)
    
    fireEvent.click(screen.getByText('Domiciliary Care'))
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Back'))
    
    // Should show step 1 again
    expect(screen.getByText('What kind of care do you provide?')).toBeTruthy()
  })
})
