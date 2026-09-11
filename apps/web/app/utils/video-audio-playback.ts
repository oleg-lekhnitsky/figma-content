type PlaybackAudioSession = { type: string }

export const requestVideoAudioPlayback = () => {
  const session = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { audioSession?: PlaybackAudioSession }).audioSession
  if (!session) return () => {}

  // iOS otherwise treats Web Audio as ambient sound, which Silent Mode mutes.
  const previousType = session.type
  session.type = 'playback'
  let released = false
  return () => {
    if (released) return
    released = true
    if (session.type === 'playback') session.type = previousType
  }
}

export const resumeVideoAudioContext = (audio: Pick<AudioContext, 'state' | 'resume'>) => {
  // Call resume before yielding so a Play tap retains Safari's user activation.
  if (audio.state === 'suspended' || audio.state === 'interrupted') return audio.resume()
  return Promise.resolve()
}
