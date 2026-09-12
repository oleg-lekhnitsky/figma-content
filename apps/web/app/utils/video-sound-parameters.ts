import type { GeneratedSound, GeneratedSoundLayer, RecipeLayer, RecipeSound, SoundPreset, SoundWave } from '../types/video-sound'

export type SoundParameterKey = 'startFrequency' | 'endFrequency' | 'gain' | 'delay' | 'attack' | 'decay' | 'sustain' | 'release' | 'filter' | 'resonance' | 'frequency' | 'sweep' | 'duration'
export type SoundParameter = { key: SoundParameterKey, label: string, value: number, min: number, max: number, step: number, unit: string }

export const soundLayers = (sound: RecipeSound) => 'layers' in sound.recipe ? sound.recipe.layers : [sound.recipe]
export const generatedSoundLayers = (sound: GeneratedSound): GeneratedSoundLayer[] => [
  { wave: sound.wave, frequency: sound.frequency, sweep: sound.sweep, duration: sound.duration, filter: sound.filter, resonance: sound.resonance, gain: sound.gain },
  ...sound.additionalLayers ?? [],
]
export const soundLayerCount = (sound: SoundPreset) => sound.kind === 'recipe' ? soundLayers(sound).length : generatedSoundLayers(sound).length

const withGeneratedLayers = (sound: GeneratedSound, layers: GeneratedSoundLayer[]): GeneratedSound => ({
  ...sound,
  ...layers[0]!,
  additionalLayers: layers.length > 1 ? layers.slice(1) : undefined,
})

export const addSoundLayer = (sound: SoundPreset): SoundPreset => {
  if (sound.kind === 'generated') return withGeneratedLayers(sound, [
    ...generatedSoundLayers(sound),
    { wave: 'sine', frequency: 1, sweep: 1, duration: 1, filter: 1800, resonance: .7, gain: .2 },
  ])
  return { ...sound, recipe: { layers: [
    ...soundLayers(sound),
    { source: { type: 'sine', frequency: 440 }, envelope: { attack: .001, decay: .03, sustain: 0, release: .01 }, gain: .2 },
  ] } }
}

export const removeSoundLayer = (sound: SoundPreset, index: number): SoundPreset => {
  const count = soundLayerCount(sound)
  if (count <= 1 || !Number.isInteger(index) || index < 0 || index >= count) return sound
  if (sound.kind === 'generated') return withGeneratedLayers(sound, generatedSoundLayers(sound).filter((_, layerIndex) => layerIndex !== index))
  return { ...sound, recipe: { layers: soundLayers(sound).filter((_, layerIndex) => layerIndex !== index) } }
}

const parameter = (key: SoundParameterKey, label: string, value: number, min: number, max: number, step: number, unit = ''): SoundParameter => (
  { key, label, value, min, max: Math.max(max, value), step, unit }
)

export const soundParameters = (sound: SoundPreset, layerIndex = 0): SoundParameter[] => {
  if (sound.kind === 'generated') {
    const layer = generatedSoundLayers(sound)[layerIndex]
    if (!layer) return []
    return [
      parameter('frequency', 'Pitch', layer.frequency, .25, 4, .01, '×'),
      parameter('sweep', 'Pitch sweep', layer.sweep, .25, 4, .01, '×'),
      parameter('duration', 'Length', layer.duration, .1, 4, .01, '×'),
      parameter('gain', 'Gain', layer.gain, 0, 3, .01, '×'),
      parameter('filter', 'Filter frequency', layer.filter, 20, 16000, 1, 'Hz'),
      parameter('resonance', 'Resonance', layer.resonance, .1, 50, .1),
    ]
  }
  const layer = soundLayers(sound)[layerIndex]
  if (!layer) return []
  const fields: SoundParameter[] = []
  if (layer.source.type !== 'noise') {
    const frequency = layer.source.frequency
    fields.push(
      parameter('startFrequency', 'Start pitch', typeof frequency === 'number' ? frequency : frequency.start, 20, 4000, 1, 'Hz'),
      parameter('endFrequency', 'End pitch', typeof frequency === 'number' ? frequency : frequency.end, 20, 4000, 1, 'Hz'),
    )
  }
  fields.push(
    parameter('gain', 'Gain', layer.gain, 0, 3, .01, '×'),
    parameter('delay', 'Delay', (layer.delay ?? 0) * 1000, 0, 1000, 1, 'ms'),
    parameter('attack', 'Attack', layer.envelope.attack * 1000, 0, 1000, .1, 'ms'),
    parameter('decay', 'Decay', layer.envelope.decay * 1000, 0, 1000, .1, 'ms'),
    parameter('sustain', 'Sustain level', layer.envelope.sustain * 100, 0, 100, 1, '%'),
    parameter('release', 'Release', layer.envelope.release * 1000, 0, 1000, .1, 'ms'),
  )
  if (layer.filter) fields.push(
    parameter('filter', 'Filter frequency', layer.filter.frequency, 20, 16000, 1, 'Hz'),
    parameter('resonance', 'Resonance', layer.filter.Q, .1, 50, .1),
  )
  return fields
}

const updateLayer = (sound: RecipeSound, index: number, update: (layer: RecipeLayer) => RecipeLayer): RecipeSound => {
  const layers = soundLayers(sound).map((layer, layerIndex) => layerIndex === index ? update(layer) : layer)
  return { ...sound, recipe: 'layers' in sound.recipe ? { layers } : layers[0]! }
}

export const updateSoundParameter = (sound: SoundPreset, layerIndex: number, key: SoundParameterKey, input: number): SoundPreset => {
  const field = soundParameters(sound, layerIndex).find(candidate => candidate.key === key)
  if (!field || !Number.isFinite(input)) return sound
  const value = Math.max(field.min, Math.min(field.max, input))
  if (sound.kind === 'generated') return withGeneratedLayers(sound, generatedSoundLayers(sound).map((layer, index) => index === layerIndex ? { ...layer, [key]: value } : layer))
  return updateLayer(sound, layerIndex, layer => {
    if (key === 'gain') return { ...layer, gain: value }
    if (key === 'delay') return { ...layer, delay: value / 1000 }
    if (key === 'attack' || key === 'decay' || key === 'release' || key === 'sustain') {
      return { ...layer, envelope: { ...layer.envelope, [key]: value / (key === 'sustain' ? 100 : 1000) } }
    }
    if ((key === 'filter' || key === 'resonance') && layer.filter) {
      return { ...layer, filter: { ...layer.filter, [key === 'filter' ? 'frequency' : 'Q']: value } }
    }
    if ((key === 'startFrequency' || key === 'endFrequency') && layer.source.type !== 'noise') {
      const old = layer.source.frequency
      const frequency = typeof old === 'number' ? { start: old, end: old } : { ...old }
      frequency[key === 'startFrequency' ? 'start' : 'end'] = value
      return { ...layer, source: { ...layer.source, frequency } }
    }
    return layer
  })
}

export const updateSoundWave = (sound: SoundPreset, layerIndex: number, wave: SoundWave | 'noise'): SoundPreset => {
  if (sound.kind === 'generated') return wave === 'noise' ? sound : withGeneratedLayers(sound, generatedSoundLayers(sound).map((layer, index) => index === layerIndex ? { ...layer, wave } : layer))
  return updateLayer(sound, layerIndex, layer => ({
    ...layer,
    source: wave === 'noise'
      ? { type: 'noise', color: 'white' }
      : { type: wave, frequency: layer.source.type === 'noise' ? 440 : layer.source.frequency },
  }))
}

export const updateSoundFilter = (sound: SoundPreset, layerIndex: number, type: BiquadFilterType | 'off'): SoundPreset => {
  if (sound.kind !== 'recipe') return sound
  return updateLayer(sound, layerIndex, layer => ({
    ...layer,
    filter: type === 'off' ? undefined : { frequency: 2000, Q: .7, ...layer.filter, type },
  }))
}

const waves: readonly unknown[] = ['sine', 'triangle', 'square', 'sawtooth']
const filters: readonly unknown[] = ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass', 'lowshelf', 'highshelf', 'peaking']
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const positive = (value: unknown): value is number => nonnegative(value) && value > 0
const validGeneratedLayer = (value: unknown): boolean => record(value) && waves.includes(value.wave)
  && ['frequency', 'sweep', 'duration'].every(key => positive(value[key]))
  && ['filter', 'resonance', 'gain'].every(key => nonnegative(value[key]))
const validLayer = (value: unknown): boolean => {
  if (!record(value) || !record(value.source) || !record(value.envelope) || !nonnegative(value.gain)) return false
  const source = value.source
  const envelope = value.envelope
  const frequency = source.frequency
  if (source.type === 'noise' ? source.color !== 'white' : !waves.includes(source.type) || !(positive(frequency) || (record(frequency) && positive(frequency.start) && positive(frequency.end)))) return false
  if (!['attack', 'decay', 'sustain', 'release'].every(key => nonnegative(envelope[key])) || Number(envelope.sustain) > 1) return false
  if (value.delay !== undefined && !nonnegative(value.delay)) return false
  return value.filter === undefined || (record(value.filter) && filters.includes(value.filter.type) && nonnegative(value.filter.frequency) && nonnegative(value.filter.Q))
}

export const isSavedSoundPreset = (value: unknown): value is SoundPreset => {
  if (!record(value) || typeof value.id !== 'string' || !value.id.startsWith('saved-') || typeof value.label !== 'string') return false
  if (value.kind === 'generated') return validGeneratedLayer(value)
    && (value.additionalLayers === undefined || (Array.isArray(value.additionalLayers) && value.additionalLayers.every(validGeneratedLayer)))
  if (value.kind !== 'recipe' || !record(value.recipe)) return false
  return 'layers' in value.recipe
    ? Array.isArray(value.recipe.layers) && value.recipe.layers.length > 0 && value.recipe.layers.every(validLayer)
    : validLayer(value.recipe)
}
