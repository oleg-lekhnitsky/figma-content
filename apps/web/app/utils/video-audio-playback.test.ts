import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestVideoAudioPlayback, resumeVideoAudioContext } from './video-audio-playback'

afterEach(() => vi.unstubAllGlobals())

describe('video soundtrack playback', () => {
  it('requests media playback and restores the previous mode when released', () => {
    const audioSession = { type: 'auto' }
    vi.stubGlobal('navigator', { audioSession })
    const release = requestVideoAudioPlayback()
    expect(audioSession.type).toBe('playback')
    release()
    expect(audioSession.type).toBe('auto')

    audioSession.type = 'playback'
    release()
    expect(audioSession.type).toBe('playback')
  })

  it('preserves an audio mode another feature requested after the editor', () => {
    const audioSession = { type: 'ambient' }
    vi.stubGlobal('navigator', { audioSession })
    const release = requestVideoAudioPlayback()
    audioSession.type = 'play-and-record'
    release()
    expect(audioSession.type).toBe('play-and-record')
  })

  it.each([undefined, {}])('supports environments without Audio Session: %s', (browserNavigator) => {
    vi.stubGlobal('navigator', browserNavigator)
    expect(() => requestVideoAudioPlayback()()).not.toThrow()
  })

  it.each(['suspended', 'interrupted'] as const)('resumes %s audio during the user gesture', async (state) => {
    const audio = { state, resume: vi.fn().mockResolvedValue(undefined) }
    const resumed = resumeVideoAudioContext(audio)
    // The resume call must happen before the event handler's first await.
    expect(audio.resume).toHaveBeenCalledOnce()
    await resumed
  })

  it.each(['running', 'closed'] as const)('does not resume %s audio', async (state) => {
    const audio = { state, resume: vi.fn().mockResolvedValue(undefined) }
    await resumeVideoAudioContext(audio)
    expect(audio.resume).not.toHaveBeenCalled()
  })
})
