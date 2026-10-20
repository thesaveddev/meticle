/**
 * Mica on the phone is an orb and a caption — no thread, no composer, no
 * cards. The carer taps, speaks, and Mica answers aloud. These tests drive the
 * screen through the voice-service double: they fire the final transcripts the
 * recogniser would deliver and assert which endpoint each utterance reaches,
 * what Mica says aloud, and where a "yes" lands.
 */
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { MicaHomeScreen } from '../MicaHomeScreen'
import type { VoiceTranscriptHandlers } from '../../services/voice'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticMedium: jest.fn(),
  hapticWarning: jest.fn(),
}))

const mockAskMica = jest.fn()
const mockPrepare = jest.fn()
const mockConfirm = jest.fn()
const mockVoiceNote = jest.fn()
const mockApproveNote = jest.fn()
jest.mock('../../services/api', () => {
  const actual = jest.requireActual('../../services/api')
  return {
    ...actual,
    askMica: (...args: any[]) => mockAskMica(...args),
    prepareMicaAction: (...args: any[]) => mockPrepare(...args),
    confirmMicaAction: (...args: any[]) => mockConfirm(...args),
    requestVoiceNote: (...args: any[]) => mockVoiceNote(...args),
    approveVoiceNote: (...args: any[]) => mockApproveNote(...args),
  }
})

let captured: VoiceTranscriptHandlers | null = null
const mockStartListening = jest.fn(async (handlers: VoiceTranscriptHandlers) => {
  captured = handlers
  return true
})
const mockSpeak = jest.fn((_text: string, _handlers?: unknown) => {})
jest.mock('../../services/voice', () => ({
  isVoiceInputSupported: jest.fn(async () => true),
  requestVoicePermission: jest.fn(async () => true),
  startListening: (handlers: VoiceTranscriptHandlers) => mockStartListening(handlers),
  stopListening: jest.fn(async () => {}),
  stopSpeaking: jest.fn(async () => {}),
  speakReply: (text: string, handlers?: unknown) => mockSpeak(text, handlers),
  isListening: jest.fn(() => false),
  normaliseVolume: jest.fn(() => 0),
}))

const session: any = { accessToken: 'token-1', user: { id: 'user-1' } }
const props: any = {
  navigation: { pop: jest.fn() },
  session,
  onNavigate: jest.fn(),
  onCloseSheet: jest.fn(),
  onOpenSheet: jest.fn(),
}

beforeEach(() => {
  mockAskMica.mockReset()
  mockPrepare.mockReset()
  mockConfirm.mockReset()
  mockVoiceNote.mockReset()
  mockApproveNote.mockReset()
  mockStartListening.mockClear()
  mockSpeak.mockClear()
  captured = null
  props.onNavigate.mockReset()
})

/** Tap the orb and wait until the recogniser is open. */
async function openEars(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByLabelText('Talk to Mica. Tap and speak.'))
  await waitFor(() => expect(mockStartListening).toHaveBeenCalled())
  if (!captured) throw new Error('recogniser never opened')
  return captured as VoiceTranscriptHandlers
}

/** Deliver a final transcript, then wait until Mica has spoken. */
async function say(handlers: VoiceTranscriptHandlers, text: string) {
  const before = mockSpeak.mock.calls.length
  handlers.onFinal?.(text)
  await waitFor(() => expect(mockSpeak.mock.calls.length).toBeGreaterThan(before))
  return mockSpeak.mock.calls[mockSpeak.mock.calls.length - 1][0] as string
}

function lastSpoken(): string {
  return mockSpeak.mock.calls[mockSpeak.mock.calls.length - 1][0] as string
}

describe('MicaHomeScreen orb', () => {
  it('shows only the orb and its caption — no thread, no composer', () => {
    const screen = render(<MicaHomeScreen {...props} />)
    expect(screen.getByLabelText('Talk to Mica. Tap and speak.')).toBeTruthy()
    expect(screen.getByText('Tap the orb and speak')).toBeTruthy()
    expect(screen.queryByLabelText('Ask Mica')).toBeNull()
    expect(screen.queryByLabelText('Send question to Mica')).toBeNull()
  })

  it('asks what was heard and speaks the answer aloud', async () => {
    mockAskMica.mockResolvedValue({ answer: 'Nia, Sam and Priya are on shift today.', sessionId: 'session-9' })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    const spoken = await say(ears, 'who is on shift today')
    expect(mockAskMica).toHaveBeenCalledWith('token-1', 'who is on shift today', undefined)
    expect(spoken).toContain('Nia, Sam and Priya')
  })

  it('keeps the renewed conversation id across turns', async () => {
    mockAskMica
      .mockResolvedValueOnce({ answer: 'First answer.', sessionId: 'session-9' })
      .mockResolvedValueOnce({ answer: 'Second answer.', sessionId: 'session-10' })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    // Bare nouns are statements, not questions — on the web too — so both
    // turns ask in words the router reads as questions.
    await say(ears, 'who is on shift today')
    await say(ears, 'what about tomorrow')

    expect(mockAskMica).toHaveBeenNthCalledWith(1, 'token-1', 'who is on shift today', undefined)
    expect(mockAskMica).toHaveBeenNthCalledWith(2, 'token-1', 'what about tomorrow', 'session-9')
  })

  it('opens the offered page when the carer says yes', async () => {
    mockAskMica.mockResolvedValue({
      answer: 'Here is the week view.',
      sessionId: 'session-9',
      offer: { path: '/scheduling', label: 'the week view', offer: 'Want me to open the week view?' },
    })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    const spoken = await say(ears, 'show me the rota')
    expect(spoken).toContain('Want me to open the week view?')
    expect(props.onNavigate).not.toHaveBeenCalled()

    await say(ears, 'yes')
    expect(props.onNavigate).toHaveBeenCalledWith('/scheduling')
  })

  it('never drafts a care note from a bare yes', async () => {
    mockAskMica.mockResolvedValue({
      answer: 'Here is the week view.',
      sessionId: 'session-9',
      offer: { path: '/scheduling', label: 'the week view', offer: 'Want me to open the week view?' },
    })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    await say(ears, 'show me the rota')
    await say(ears, 'yes')

    expect(mockVoiceNote).not.toHaveBeenCalled()
    expect(props.onNavigate).toHaveBeenCalledWith('/scheduling')
  })

  it('prepares a task draft and saves it when the carer says yes', async () => {
    mockPrepare.mockResolvedValue({
      draft: true,
      action: 'CREATE_TASK',
      utterance: 'add a task to check the fire doors',
      output: { title: 'Check the fire doors' },
      summary: 'Task prepared: check the fire doors.',
    })
    mockConfirm.mockResolvedValue({ confirmed: true, sessionId: 'session-9' })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    const spoken = await say(ears, 'add a task to check the fire doors')
    // The screen passes the intent's prefill through untouched; the api client
    // stamps `utterance` and `source: 'voice'` onto it (as the web does).
    expect(mockPrepare).toHaveBeenCalledWith(
      'token-1',
      'CREATE_TASK',
      'add a task to check the fire doors',
      {},
    )
    expect(spoken).toContain('Shall I save it?')

    await say(ears, 'yes')
    expect(mockConfirm).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ draft: true }),
      undefined,
    )
    expect(lastSpoken()).toContain('Saved.')
  })

  it('ends at Saved when the saved record lives on a web-only page', async () => {
    // The confirm offer names `/tasks?task=…`, which the phone cannot open —
    // it resolves to the notifications list. Mica must not ask "want me to
    // open it?", and a following "yes" must not land on that list either.
    mockPrepare.mockResolvedValue({
      draft: true,
      action: 'CREATE_TASK',
      utterance: 'add a task to check the fire doors',
      output: { title: 'Check the fire doors' },
      summary: 'Task prepared: check the fire doors.',
    })
    mockConfirm.mockResolvedValue({
      confirmed: true,
      sessionId: 'session-9',
      result: { taskId: 'task-1' },
      offer: { path: '/tasks?task=task-1', label: 'the new task', offer: 'Want me to open the new task?' },
    })
    mockVoiceNote.mockResolvedValue({
      result: { daily_note: { content: 'Noted.', shift: 'day', category: 'wellbeing' } },
      person: { id: 'person-1', name: 'Grace' },
      noteContext: { personId: 'person-1', shift: 'day', noteDate: '2026-10-20', source: 'voice' },
    })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    await say(ears, 'add a task to check the fire doors')
    const done = await say(ears, 'yes')
    expect(done).toBe('Saved.')
    expect(props.onNavigate).not.toHaveBeenCalled()

    // With no offer waiting, the next "yes" is an ordinary turn — not a
    // detour onto the notifications list.
    await say(ears, 'yes')
    expect(props.onNavigate).not.toHaveBeenCalled()
  })

  it('drops the draft when the carer says no', async () => {
    mockPrepare.mockResolvedValue({
      draft: true,
      action: 'CREATE_TASK',
      utterance: 'add a task to check the fire doors',
      output: { title: 'Check the fire doors' },
      summary: 'Task prepared: check the fire doors.',
    })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    await say(ears, 'add a task to check the fire doors')
    await say(ears, 'no')

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(lastSpoken()).toContain('dropped')
  })

  it('drafts a care note from a statement and saves it on yes', async () => {
    mockVoiceNote.mockResolvedValue({
      result: { daily_note: { content: 'Grace ate well.', shift: 'day', category: 'wellbeing' } },
      person: { id: 'person-1', name: 'Grace' },
      noteContext: { personId: 'person-1', shift: 'day', noteDate: '2026-10-20', source: 'voice' },
    })
    mockApproveNote.mockResolvedValue({ dailyNote: { id: 'note-1' } })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    const spoken = await say(ears, 'Grace had a good lunch')
    expect(mockVoiceNote).toHaveBeenCalledWith(
      'token-1',
      'Grace had a good lunch',
      expect.objectContaining({ personName: 'Grace', noteDate: expect.any(String) }),
    )
    expect(spoken).toContain('yes to save it')

    await say(ears, 'yes')
    expect(mockApproveNote).toHaveBeenCalledWith(
      'token-1',
      'person-1',
      expect.objectContaining({ daily_note: expect.anything() }),
      expect.objectContaining({ noteDate: '2026-10-20' }),
    )
    expect(lastSpoken()).toContain('saved')
  })

  it('does not offer the profile page after saving a note — the phone cannot open it', async () => {
    mockVoiceNote.mockResolvedValue({
      result: { daily_note: { content: 'Grace ate well.', shift: 'day', category: 'wellbeing' } },
      person: { id: 'person-1', name: 'Grace' },
      noteContext: { personId: 'person-1', shift: 'day', noteDate: '2026-10-20', source: 'voice' },
    })
    // The server offers the note on the profile, gated by module access — but
    // the profile is web-only, so the phone must end at the sentence.
    mockApproveNote.mockResolvedValue({
      dailyNote: { id: 'note-1' },
      offer: { path: '/people/person-1?tab=daily-notes&source=note-1', label: 'the new care note', offer: 'Want me to open the new care note?' },
    })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    await say(ears, 'Grace had a good lunch')
    const done = await say(ears, 'yes')
    expect(done).toBe('Care note saved.')
    expect(props.onNavigate).not.toHaveBeenCalled()
  })

  it('asks aloud who a note is about when the name does not resolve', async () => {
    const { ApiError } = jest.requireActual('../../services/api')
    mockVoiceNote.mockRejectedValueOnce(new ApiError(400, 'No active person named "Grac" found in this organisation'))
    mockVoiceNote.mockResolvedValueOnce({
      result: { daily_note: { content: 'Grace ate well.', shift: 'day', category: 'wellbeing' } },
      person: { id: 'person-1', name: 'Grace Hopper' },
      noteContext: { personId: 'person-1', shift: 'day', noteDate: '2026-10-20', source: 'voice' },
    })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    const question = await say(ears, 'Grac had a good lunch')
    expect(question).toContain('No active person named')

    // The answer is the name said again — resent with the original utterance.
    await say(ears, 'Grace Hopper')
    expect(mockVoiceNote).toHaveBeenNthCalledWith(
      2,
      'token-1',
      'Grac had a good lunch',
      expect.objectContaining({ personName: 'Grace Hopper' }),
    )
  })

  it('ends the session on a stop phrase without ending the screen', async () => {
    mockAskMica.mockResolvedValue({ answer: 'Nia is on shift.', sessionId: 'session-9' })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    await say(ears, 'who is on shift today')
    const farewell = await say(ears, 'that is all', )
    expect(farewell).toContain('Goodbye')
    expect(mockAskMica).toHaveBeenCalledTimes(1)
  })

  it('a sentence containing a stop word keeps the session alive', async () => {
    // "close the incident" is a statement, so it routes as a care-note turn —
    // the point is it is a turn at all, not a farewell.
    mockVoiceNote.mockResolvedValue({
      result: { daily_note: { content: 'Incident closed.', shift: 'day', category: 'wellbeing' } },
      person: { id: 'person-1', name: 'Grace' },
      noteContext: { personId: 'person-1', shift: 'day', noteDate: '2026-10-20', source: 'voice' },
    })
    const screen = render(<MicaHomeScreen {...props} />)
    const ears = await openEars(screen)

    await say(ears, 'close the incident')
    expect(mockVoiceNote).toHaveBeenCalledWith(
      'token-1',
      'close the incident',
      expect.objectContaining({ noteDate: expect.any(String) }),
    )
    expect(lastSpoken()).not.toContain('Goodbye')
  })
})
