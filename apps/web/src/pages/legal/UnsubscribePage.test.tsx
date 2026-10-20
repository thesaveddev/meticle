import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const get = vi.fn()
const post = vi.fn()
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: any[]) => get(...args),
    post: (...args: any[]) => post(...args),
  },
}))

import UnsubscribePage from './UnsubscribePage'

/**
 * The page a person actually lands on from an email.
 *
 * The API's own contract is covered by the integration suite; what these cases
 * pin is the promise the page makes to the reader — it names the address and the
 * category before stopping anything, it is the press that stops it rather than the
 * page load (a link scanner must not unsubscribe on fetch), and it does not claim
 * success it did not get.
 */

function renderAt(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/unsubscribe?token=${encodeURIComponent(token)}`]}>
      <UnsubscribePage />
    </MemoryRouter>,
  )
}

const DETAILS = { email: 'carer@example.com', scope: 'notifications', scope_label: 'notification, reminder and survey emails' }

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('the unsubscribe page', () => {
  it('names the address and what will stop, and asks rather than acting on load', async () => {
    get.mockResolvedValue({ data: DETAILS })

    renderAt('good-token')

    await screen.findByText('Stop these emails?')
    expect(screen.getByText('carer@example.com')).toBeInTheDocument()
    expect(screen.getByText(/notification, reminder and survey emails/)).toBeInTheDocument()
    // Loading the page looked the link up; it did not act on it.
    expect(post).not.toHaveBeenCalled()
    // And it says plainly what is not affected, so nobody thinks a reset will stop.
    expect(screen.getByText(/password resets, security alerts, receipts and statutory notices/i)).toBeInTheDocument()
  })

  it('is the button press that records it, and then says so', async () => {
    get.mockResolvedValue({ data: DETAILS })
    post.mockResolvedValue({ data: { unsubscribed: true } })

    renderAt('good-token')

    await userEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }))

    expect(post).toHaveBeenCalledWith('/email/unsubscribe', { token: 'good-token' }, expect.objectContaining({ silentError: true }))
    expect(await screen.findByText(/You’re unsubscribed/)).toBeInTheDocument()
    expect(screen.getByText(/will not send/)).toBeInTheDocument()
  })

  it('tells a broken link what to do instead of showing a dead page', async () => {
    get.mockRejectedValue({ response: { status: 400, data: { message: 'This unsubscribe link is not valid.' } } })

    renderAt('cut-short')

    expect(await screen.findByText('This link is not valid')).toBeInTheDocument()
    expect(screen.getByText(/This unsubscribe link is not valid/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unsubscribe' })).not.toBeInTheDocument()
  })

  it('offers a retry, not a false success, when the record fails', async () => {
    get.mockResolvedValue({ data: DETAILS })
    post.mockRejectedValue({ response: { status: 500, data: { message: 'We could not record that.' } } })

    renderAt('good-token')

    await userEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }))

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    // Still subscribed as far as anyone can tell, so the page must not say otherwise.
    expect(screen.queryByText(/You’re unsubscribed/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
