import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MicaOverlay from './MicaOverlay'
import { createMicaAudioChannel } from './mica.audio'

/**
 * The overlay is deliberately smaller than it was: the typing box and the
 * "who is this about?" picker are gone. Both removals are asserted here, because
 * a regression that quietly re-adds either one would put a data-entry step back
 * in the middle of a spoken conversation.
 */
const baseProps = {
  // The amplitude channel, not a level: a number here would be state changing
  // sixty times a second, and this dialog must not re-render for any of them.
  audio: createMicaAudioChannel(),
  transcript: '',
  responseMessage: null,
  lastNavigation: null,
  onMinimise: vi.fn(),
  onCancel: vi.fn(),
}

/**
 * A draft exactly as `/ai/mica/actions` returns one for a task.
 *
 * The names are the server's resolved ones: the card lists what the server read
 * back from the utterance, so the two cannot disagree about who the record is for.
 */
const TASK_DRAFT = {
  action: 'CREATE_TASK' as const,
  summary: "I've prepared a task about Grace Roberts, assigned to Tom Bradley, due 2026-10-20, priority high. Shall I save it?",
  output: {
    title: 'Order new grip rails',
    personName: 'Grace Roberts',
    assigneeName: 'Tom Bradley',
    dueDate: '2026-10-20',
    priority: 'high',
  },
  envelope: { draft: true, action: 'CREATE_TASK', summary: 'x', output: {} },
}

describe('MicaOverlay', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<MicaOverlay {...baseProps} state="idle" />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the listening dialog with the live transcript and no data entry', () => {
    render(<MicaOverlay {...baseProps} state="listening" transcript="Grace had a good lunch" />)

    const dialog = screen.getByRole('dialog', { name: 'Mica voice assistant' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('“Grace had a good lunch”')).toBeInTheDocument()

    // No typing box and no person picker: voice is the only entry point, and a
    // note's subject comes from what was said (useMica asks aloud if it cannot
    // tell who the note is about).
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByLabelText(/who is this note about/i)).toBeNull()

    // Both exits are present: minimise (keep listening over the page) and end.
    expect(screen.getByRole('button', { name: /minimise mica and keep listening/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /end the conversation with mica/i })).toBeInTheDocument()
  })

  it('minimises without ending the session, and ends it when asked', () => {
    const onMinimise = vi.fn()
    const onCancel = vi.fn()
    render(<MicaOverlay {...baseProps} state="listening" onMinimise={onMinimise} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: /minimise mica and keep listening/i }))
    expect(onMinimise).toHaveBeenCalledTimes(1)
    // Minimising is not closing: the session continues in the bar.
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /end the conversation with mica/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ends on Escape, since that is the keyboard exit from a live session', () => {
    const onCancel = vi.fn()
    render(<MicaOverlay {...baseProps} state="responding" responseMessage="Here's the rota." onCancel={onCancel} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('says where Mica just took the user', () => {
    render(
      <MicaOverlay
        {...baseProps}
        state="responding"
        responseMessage="Here's Evan Turner's March 2026 MAR chart."
        lastNavigation={{ path: '/emedication?personId=p9&month=2026-03', label: "Evan Turner's March 2026 MAR chart" }}
      />,
    )

    expect(screen.getAllByText(/Here's Evan Turner's March 2026 MAR chart\./).length).toBeGreaterThan(0)
    expect(screen.getByText(/Opened Evan Turner's March 2026 MAR chart/)).toBeInTheDocument()
    expect(document.querySelector('[data-mica-destination="/emedication?personId=p9&month=2026-03"]')).not.toBeNull()
  })

  it('shows the record Mica prepared, with its fields and both answers', () => {
    const onSaveDraft = vi.fn()
    const onDiscardDraft = vi.fn()
    render(
      <MicaOverlay
        {...baseProps}
        state="responding"
        responseMessage={TASK_DRAFT.summary}
        draft={TASK_DRAFT}
        onSaveDraft={onSaveDraft}
        onDiscardDraft={onDiscardDraft}
      />,
    )

    // The spoken read-back and the card are the same draft, and the card carries
    // the fields rather than repeating the sentence.
    expect(screen.getByRole('group', { name: 'Draft prepared by Mica, waiting to be saved' })).toBeInTheDocument()
    const card = document.querySelector('[data-mica-draft="CREATE_TASK"]')
    expect(card).not.toBeNull()
    expect(card).toHaveTextContent('Order new grip rails')
    expect(card).toHaveTextContent('Grace Roberts')
    expect(card).toHaveTextContent('Tom Bradley')
    expect(card).toHaveTextContent('High')
    // The due date as the day it names — not the day before it, which is what
    // formatting a bare YYYY-MM-DD date in local time produces west of Greenwich.
    expect(card).toHaveTextContent(/20 Oct/)
    expect(card).not.toHaveTextContent(/19 Oct/)

    // Both answers are present, and saying "yes" is named as one of them.
    fireEvent.click(screen.getByRole('button', { name: /save task/i }))
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    expect(onDiscardDraft).toHaveBeenCalledTimes(1)
    expect(card).toHaveTextContent(/say “yes” to save it/i)
  })

  it('has no card when there is nothing prepared', () => {
    render(<MicaOverlay {...baseProps} state="responding" responseMessage="Here's the rota." />)

    expect(document.querySelector('[data-mica-draft]')).toBeNull()
    expect(screen.queryByRole('button', { name: /save task/i })).toBeNull()
  })

  it('says it is saving, and takes no second save, while the draft is in flight', () => {
    const onSaveDraft = vi.fn()
    render(
      <MicaOverlay {...baseProps} state="thinking" draft={TASK_DRAFT} savingDraft onSaveDraft={onSaveDraft} />,
    )

    const save = screen.getByRole('button', { name: /saving/i })
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(onSaveDraft).not.toHaveBeenCalled()
  })

  it('offers the page a reply ended on, tappable instead of saying yes', () => {
    const onOpenOffer = vi.fn()
    render(
      <MicaOverlay
        {...baseProps}
        state="responding"
        responseMessage="Saved. Want me to open the new task?"
        offer={{ path: '/tasks?task=t1', label: 'the new task', question: 'Want me to open the new task?' }}
        onOpenOffer={onOpenOffer}
      />,
    )

    const control = document.querySelector('[data-mica-offer="/tasks?task=t1"]')
    expect(control).not.toBeNull()
    expect(control).toHaveTextContent('Open the new task')

    // A page still waiting on the carer has not been opened: the destination chip
    // states "Opened …" as a fact and must not be used for an offer.
    expect(screen.queryByText(/^Opened /)).toBeNull()

    fireEvent.click(control as Element)
    expect(onOpenOffer).toHaveBeenCalledTimes(1)
  })

  it('renders a failure as the error state, not as a calm response', () => {
    const onCancel = vi.fn()
    const { container } = render(
      <MicaOverlay
        {...baseProps}
        state="error"
        responseMessage="Mica could not reach the AI service. Check AI settings."
        onCancel={onCancel}
      />,
    )

    // Still one labelled modal dialog, and still dismissable.
    expect(screen.getByRole('dialog', { name: 'Mica voice assistant' })).toBeInTheDocument()

    // The message is shown with the error treatment rather than the ordinary card.
    const card = container.querySelector('[data-mica-message="error"]')
    expect(card).not.toBeNull()
    expect(card).toHaveTextContent('could not reach the AI service')
    expect(screen.queryByText('responding…')).toBeNull()

    // The orb carries the danger ring and no speech waveform.
    expect(container.querySelector('[data-mica-ring="error"]')).not.toBeNull()
    expect(container.querySelector('[data-mica-waveform]')).toBeNull()

    // A failure is not minimisable — there is nothing left to listen for — and
    // it is announced for screen-reader users.
    expect(screen.queryByRole('button', { name: /minimise mica/i })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('could not reach the AI service')

    fireEvent.click(screen.getByRole('button', { name: /end the conversation with mica/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
