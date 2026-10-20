/**
 * Mica's ears and voice are native code that does not exist under jest — or in
 * Expo Go, only in dev and EAS builds. These tests drive the service through
 * the module doubles in jest.setup.ts: they fire the listeners the service
 * subscribes to, which is the whole surface the screen depends on.
 */
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition'
import * as Speech from 'expo-speech'
import {
  isListening,
  isVoiceInputSupported,
  normaliseVolume,
  requestVoicePermission,
  speakReply,
  startListening,
  stopListening,
  stopSpeaking,
} from '../voice'

const moduleMock = ExpoSpeechRecognitionModule as unknown as {
  requestPermissionsAsync: jest.Mock
  isRecognitionAvailable: jest.Mock
  start: jest.Mock
  stop: jest.Mock
  addListener: jest.Mock
}
const speakMock = Speech.speak as jest.Mock
const stopMock = Speech.stop as jest.Mock

/** The listeners `startListening` subscribed, keyed by event name. */
function listeners(): Record<string, (e: unknown) => void> {
  const map: Record<string, (e: unknown) => void> = {}
  for (const call of moduleMock.addListener.mock.calls) {
    map[call[0] as string] = call[1] as (e: unknown) => void
  }
  return map
}

const finalEvent = (transcript: string) => ({
  isFinal: true,
  results: [{ transcript, confidence: 0.9, segments: [] }],
})

beforeEach(async () => {
  await stopListening().catch(() => {})
  jest.clearAllMocks()
  moduleMock.isRecognitionAvailable.mockReturnValue(true)
  moduleMock.requestPermissionsAsync.mockResolvedValue({ granted: true })
  moduleMock.addListener.mockImplementation(() => ({ remove: jest.fn() }))
})

describe('voice support and permission', () => {
  it('reports support from the recogniser, not from a build flag', async () => {
    await expect(isVoiceInputSupported()).resolves.toBe(true)
    moduleMock.isRecognitionAvailable.mockReturnValue(false)
    await expect(isVoiceInputSupported()).resolves.toBe(false)
  })

  it('answers false when the native module itself is absent', async () => {
    moduleMock.isRecognitionAvailable.mockImplementation(() => {
      throw new Error('The method or property is not available')
    })
    await expect(isVoiceInputSupported()).resolves.toBe(false)
  })

  it('passes the permission answer through, and refusal reads as false', async () => {
    await expect(requestVoicePermission()).resolves.toBe(true)
    moduleMock.requestPermissionsAsync.mockResolvedValue({ granted: false })
    await expect(requestVoicePermission()).resolves.toBe(false)
  })
})

describe('startListening', () => {
  it('starts one recognition run in en-GB with interim results', async () => {
    const started = await startListening({})
    expect(started).toBe(true)
    expect(moduleMock.start).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'en-GB', interimResults: true }),
    )
    expect(isListening()).toBe(true)
  })

  it('refuses a second run while one is open, rather than doubling transcripts', async () => {
    await startListening({})
    moduleMock.start.mockClear()
    const started = await startListening({})
    expect(started).toBe(false)
    expect(moduleMock.start).not.toHaveBeenCalled()
  })

  it('delivers interim words while speaking and the final turn when done', async () => {
    const onPartial = jest.fn()
    const onFinal = jest.fn()
    await startListening({ onPartial, onFinal })

    listeners().result({ isFinal: false, results: [{ transcript: 'who is on', confidence: 0, segments: [] }] })
    expect(onPartial).toHaveBeenCalledWith('who is on')
    expect(onFinal).not.toHaveBeenCalled()

    listeners().result(finalEvent('who is on shift today'))
    expect(onFinal).toHaveBeenCalledWith('who is on shift today')
    expect(isListening()).toBe(false)
  })

  it('treats silence as an empty final turn, not a failure', async () => {
    const onFinal = jest.fn()
    const onSpeechError = jest.fn()
    await startListening({ onFinal, onSpeechError })

    listeners().error({ error: 'no-speech', message: 'No final speech was detected.' })
    expect(onFinal).toHaveBeenCalledWith('')
    expect(onSpeechError).not.toHaveBeenCalled()
  })

  it('maps a denied microphone to a fatal error the screen can explain', async () => {
    const onSpeechError = jest.fn()
    await startListening({ onSpeechError })

    listeners().error({ error: 'not-allowed', message: 'Permission denied.' })
    expect(onSpeechError).toHaveBeenCalledWith(expect.stringContaining('permission'), true)
  })

  it('maps a network failure to a retryable error', async () => {
    const onSpeechError = jest.fn()
    await startListening({ onSpeechError })

    listeners().error({ error: 'network', message: 'Network failure.' })
    expect(onSpeechError).toHaveBeenCalledWith(expect.stringContaining('connection'), false)
  })
})

describe('normaliseVolume', () => {
  it('maps the native -2..10 range onto the orb’s 0..1', () => {
    expect(normaliseVolume(-2)).toBe(0)
    expect(normaliseVolume(-10)).toBe(0)
    expect(normaliseVolume(2)).toBe(0.5)
    expect(normaliseVolume(6)).toBe(1)
    expect(normaliseVolume(100)).toBe(1)
  })

  it('reads anything unusable as stillness', () => {
    expect(normaliseVolume(undefined)).toBe(0)
    expect(normaliseVolume('loud')).toBe(0)
    expect(normaliseVolume(NaN)).toBe(0)
  })
})

describe('speakReply', () => {
  it('reads the reply aloud in en-GB', () => {
    speakReply('Nia, Sam and Priya are on shift today.')
    expect(speakMock).toHaveBeenCalledWith(
      'Nia, Sam and Priya are on shift today.',
      expect.objectContaining({ language: 'en-GB' }),
    )
  })

  it('treats an empty reply as already spoken', () => {
    const onDone = jest.fn()
    speakReply('   ', { onDone })
    expect(speakMock).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })

  it('stops speaking without throwing when nothing is speaking', async () => {
    await expect(stopSpeaking()).resolves.toBeUndefined()
    expect(stopMock).toHaveBeenCalled()
  })

  it('ends the listen and releases listeners when stopped idle', async () => {
    await startListening({})
    await stopListening()
    expect(isListening()).toBe(false)
    expect(moduleMock.stop).toHaveBeenCalled()
  })
})
