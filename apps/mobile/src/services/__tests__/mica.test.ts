/**
 * The phone asks the same endpoint the web assistant asks, so the answers are
 * the same Mica. These tests pin the envelope both ways: the question and the
 * conversation id go out, and the answer, navigation, offer and renewed session
 * id come back intact for the screen to honour.
 */
const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
const mockDeleteItem = jest.fn()

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: any[]) => mockGetItem(...args),
  setItemAsync: (...args: any[]) => mockSetItem(...args),
  deleteItemAsync: (...args: any[]) => mockDeleteItem(...args),
}))

import { approveVoiceNote, askMica, ApiError, confirmMicaAction, prepareMicaAction, requestVoiceNote, settleMicaIntent } from '../api'

function jsonResponse(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) } as any
}

beforeEach(() => {
  mockGetItem.mockReset()
  mockSetItem.mockReset()
  mockDeleteItem.mockReset()
  global.fetch = jest.fn() as any
})

describe('askMica', () => {
  it('sends the question with the conversation id and returns the whole envelope', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue(jsonResponse(200, {
      answer: 'Nia, Sam and Priya are on shift today.',
      sessionId: 'session-9',
      offer: { path: '/scheduling', label: 'the week view', offer: 'Want me to open the week view?' },
    }))

    const res = await askMica('token-1', 'Who is on shift today?', 'session-8')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/ai/mica/ask')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ question: 'Who is on shift today?', sessionId: 'session-8' })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1')
    expect(res).toMatchObject({
      answer: 'Nia, Sam and Priya are on shift today.',
      sessionId: 'session-9',
      offer: { path: '/scheduling' },
    })
  })

  it('omits the session id on the first turn of a conversation', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue(jsonResponse(200, { answer: 'Hello.', sessionId: 'session-1' }))

    await askMica('token-1', 'Hello')

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ question: 'Hello' })
  })

  it('carries the remembered person so follow-ups land on the same resident', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue(jsonResponse(200, { answer: 'Her mood was good.', sessionId: 'session-2' }))

    await askMica('token-1', 'and her mood?', 'session-1', { personName: 'Grace' })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      question: 'and her mood?',
      sessionId: 'session-1',
      personName: 'Grace',
    })
  })

  it('settles an ambiguous imperative to a write action or an explicit none', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { intent: { action: 'CREATE_APPOINTMENT' }, action: 'CREATE_APPOINTMENT' }))

    const res = await settleMicaIntent('token-1', 'book podiatry')

    expect(fetchMock.mock.calls[0][0]).toContain('/ai/mica/settle')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ utterance: 'book podiatry' })
    expect(res.intent?.action).toBe('CREATE_APPOINTMENT')
  })

  it('prepares a write action with the utterance and voice source stamped on the input', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue(jsonResponse(200, {
      draft: true,
      action: 'CREATE_TASK',
      utterance: 'add a task to check the fire doors',
      output: { title: 'Check the fire doors' },
      summary: 'Task prepared: check the fire doors.',
    }))

    const res = await prepareMicaAction('token-1', 'CREATE_TASK', 'add a task to check the fire doors', {})

    // The web sends the same envelope: action, utterance, and the input with
    // the utterance repeated inside it and the source marked voice.
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'CREATE_TASK',
      utterance: 'add a task to check the fire doors',
      input: { utterance: 'add a task to check the fire doors', source: 'voice' },
    })
    expect(res.draft).toBe(true)
  })

  it('confirms with the server-issued envelope untouched, plus the session', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue(jsonResponse(200, { confirmed: true, sessionId: 'session-9' }))
    const envelope = { draft: true, action: 'CREATE_TASK', output: { title: 'x' }, summary: 'y' }

    await confirmMicaAction('token-1', envelope, 'session-8')

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ draft: envelope, sessionId: 'session-8' })
  })

  it('sends a care note with the transcript as both transcription and intent', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue(jsonResponse(200, {
      result: { daily_note: { content: 'Grace ate well.' } },
      person: { id: 'person-1', name: 'Grace' },
      noteContext: { personId: 'person-1', shift: 'day', noteDate: '2026-10-20', source: 'voice' },
    }))

    await requestVoiceNote('token-1', 'Grace had a good lunch', { personName: 'Grace', noteDate: '2026-10-20' })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      transcription: 'Grace had a good lunch',
      intent: 'Grace had a good lunch',
      personName: 'Grace',
      source: 'voice',
      noteDate: '2026-10-20',
    })
  })

  it('approves a note by re-sending the generated content with its context', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue(jsonResponse(201, { dailyNote: { id: 'note-1' } }))

    await approveVoiceNote(
      'token-1',
      'person-1',
      { daily_note: { content: 'Grace ate well.', shift: 'day', category: 'wellbeing' }, mood_analysis: { mood_score: 8 } },
      { shift: 'day', noteDate: '2026-10-20' },
    )

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      personId: 'person-1',
      dailyNote: { content: 'Grace ate well.', shift: 'day', category: 'wellbeing' },
      source: 'voice',
      noteDate: '2026-10-20',
    })
    expect(body.moodAnalysis).toEqual({ mood_score: 8 })
  })

  it('surfaces the server refusal instead of an empty answer', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue(jsonResponse(400, { error: { message: 'Mica could not determine what you meant. Try rewording.' } }))

    const err: unknown = await askMica('token-1', 'asdf').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(400)
    expect((err as ApiError).message).toBe('Mica could not determine what you meant. Try rewording.')
  })
})
