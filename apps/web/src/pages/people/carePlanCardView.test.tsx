import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CarePlanCardView } from './carePlanCardView'

describe('CarePlanCardView', () => {
  const plan = {
    id: 'plan-1',
    title: 'Medication Plan',
    category: 'medication',
    description: 'Follow the documented medication support instructions.',
    status: 'active',
    review_date: '2020-01-01',
  }

  it('opens the read-only detail when the card is clicked and keeps actions independent', () => {
    const onView = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<CarePlanCardView plan={plan} onView={onView} onEdit={onEdit} onDelete={onDelete} />)

    fireEvent.click(screen.getByRole('button', { name: 'View care plan: Medication Plan' }))
    expect(onView).toHaveBeenCalledWith(plan)

    fireEvent.click(screen.getByRole('button', { name: 'Edit Medication Plan' }))
    expect(onEdit).toHaveBeenCalledWith(plan)
    expect(onView).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Delete Medication Plan' }))
    expect(onDelete).toHaveBeenCalledWith(plan)
    expect(onView).toHaveBeenCalledTimes(1)
  })

  it('shows category, actual status and overdue review date without inventing values', () => {
    render(<CarePlanCardView plan={plan} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} now={new Date('2026-01-01T12:00:00')} />)
    expect(screen.getByText('medication')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText(/Review: 01\/01\/2020 · Overdue/)).toBeInTheDocument()

    render(<CarePlanCardView plan={{ ...plan, id: 'plan-2', status: undefined, review_date: null, category: undefined }} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/Not scheduled/)).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})
