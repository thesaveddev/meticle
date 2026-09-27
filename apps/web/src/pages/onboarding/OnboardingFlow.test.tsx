import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import OnboardingFlow from './OnboardingFlow'

// Mock localStorage
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'test-user', role: 'ORG_ADMIN', organization_id: 'test-org' }))
})

// The stored user is an ORG_ADMIN with an organization_id, so OnboardingFlow
// takes its hydrated path: it fetches the saved organisation on mount.
//
// Both halves of that used to be missing, and they fail in different ways.
//
//   1. `get` was absent from this mock, so the mount effect threw
//      `default.get is not a function`. The six tests below all died on that
//      one line and none of them were testing the wizard.
//
//   2. Even with `get` mocked, the component renders a spinner while it
//      hydrates, and only reaches step 1 once the request settles. The
//      original assertions were synchronous, so they would have run against
//      the spinner and found nothing. Every assertion that depends on the
//      wizard being on screen has to await it.
const mockGet = vi.fn()
const mockPatch = vi.fn()
const mockPost = vi.fn()

vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

/** A saved organisation with no progress: the state of a brand-new signup. */
const blankOrg = {
  service_types: [],
  name: '',
  onboarding_completed: false,
  onboarding_step: 1,
}

const renderHydrated = async (ui: React.ReactElement) => {
  const result = render(<MemoryRouter>{ui}</MemoryRouter>)
  // The spinner carries role="status" and is only rendered while `hydrating`
  // is true, so its disappearance is the signal that the saved organisation
  // has loaded — whichever step that lands the user on. Waiting on step 1's
  // heading instead would hang for a user resuming at step 2 or 3.
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  return result
}

/** Renders and waits for step 1 specifically, for the fresh-signup cases. */
const renderWithRouter = async (ui: React.ReactElement) => {
  const result = await renderHydrated(ui)
  await screen.findByText('What kind of care do you provide?')
  return result
}

describe('OnboardingFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({ data: blankOrg })
    mockPatch.mockResolvedValue({ data: {} })
    mockPost.mockResolvedValue({ data: {} })
  })

  it('renders step 1 with all four service type cards', async () => {
    await renderWithRouter(<OnboardingFlow />)

    expect(screen.getByText('Domiciliary Care')).toBeTruthy()
    expect(screen.getByText('Supported Living')).toBeTruthy()
    expect(screen.getByText('Care Home')).toBeTruthy()
    expect(screen.getByText('Live-in Care')).toBeTruthy()
  })

  it('loads the saved organisation for the signed-in user', async () => {
    await renderWithRouter(<OnboardingFlow />)

    expect(mockGet).toHaveBeenCalledWith('/organizations/test-org')
  })

  it('allows multi-selecting service types', async () => {
    await renderWithRouter(<OnboardingFlow />)

    fireEvent.click(screen.getByText('Domiciliary Care'))
    fireEvent.click(screen.getByText('Supported Living'))

    // Both are selected, so Continue is enabled.
    const continueBtn = screen.getByText('Continue')
    expect((continueBtn as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables Continue when no types selected', async () => {
    await renderWithRouter(<OnboardingFlow />)

    const continueBtn = screen.getByText('Continue')
    expect((continueBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('navigates to step 2 when Continue is clicked', async () => {
    await renderWithRouter(<OnboardingFlow />)

    fireEvent.click(screen.getByText('Domiciliary Care'))
    fireEvent.click(screen.getByText('Continue'))

    // Step 2 renders after the awaited PATCH resolves.
    expect(await screen.findByText('Tell us about your organisation')).toBeTruthy()
    expect(mockPatch).toHaveBeenCalledWith('/organizations/test-org', expect.objectContaining({
      service_types: ['domiciliary'],
      onboarding_step: 1,
    }))
  })

  it('shows selected types as chips in step 2', async () => {
    await renderWithRouter(<OnboardingFlow />)

    fireEvent.click(screen.getByText('Domiciliary Care'))
    fireEvent.click(screen.getByText('Care Home'))
    fireEvent.click(screen.getByText('Continue'))

    await screen.findByText('Tell us about your organisation')
    // Both still on screen as the summary chips.
    expect(screen.getByText('Domiciliary Care')).toBeTruthy()
    expect(screen.getByText('Care Home')).toBeTruthy()
  })

  it('allows going back from step 2 to step 1', async () => {
    await renderWithRouter(<OnboardingFlow />)

    fireEvent.click(screen.getByText('Domiciliary Care'))
    fireEvent.click(screen.getByText('Continue'))
    await screen.findByText('Tell us about your organisation')

    fireEvent.click(screen.getByText('Back'))

    expect(await screen.findByText('What kind of care do you provide?')).toBeTruthy()
  })

  // The case the broken mock was hiding: a user who abandoned onboarding part
  // way through and comes back later. Real care homes activate over days, not
  // in one sitting, so this is the common path rather than an edge case.
  it('resumes where the user left off', async () => {
    mockGet.mockResolvedValue({
      data: {
        service_types: ['care_home'],
        name: 'Orbis House',
        onboarding_completed: false,
        onboarding_step: 2,
      },
    })

    await renderHydrated(<OnboardingFlow />)

    // Straight to step 2, with the name they already typed.
    expect(await screen.findByText('Tell us about your organisation')).toBeTruthy()
    const nameField = screen.getByLabelText('Organization Name') as HTMLInputElement
    expect(nameField.value).toBe('Orbis House')
  })

  it('does not show the wizard at all once onboarding is complete', async () => {
    mockGet.mockResolvedValue({
      data: {
        service_types: ['care_home'],
        name: 'Orbis House',
        onboarding_completed: true,
        onboarding_step: 3,
      },
    })

    await renderHydrated(<OnboardingFlow />)

    // A user who has already finished onboarding is sent onwards, not shown
    // the wizard again — and specifically not shown step 1, which would let
    // them silently overwrite service types that are in use.
    expect(await screen.findByText('Go to Dashboard')).toBeTruthy()
    expect(screen.queryByText('What kind of care do you provide?')).toBeNull()
  })

  // A failed load must not leave someone staring at a spinner with no way
  // forward. This is the state a customer hits on a flaky connection, and it
  // is the one path that can silently strand a signup.
  it('explains itself when saved progress cannot be loaded', async () => {
    mockGet.mockRejectedValue(new Error('network down'))

    render(<MemoryRouter><OnboardingFlow /></MemoryRouter>)

    expect(await screen.findByText(
      'We could not load your saved onboarding progress. Please refresh and try again.'
    )).toBeTruthy()
    // The spinner must not be what they are left looking at.
    expect(screen.queryByRole('status')).toBeNull()
  })
})
