import { describe, expect, it } from 'vitest'
import type { GeneratedSound, RecipeSound } from '../types/video-sound'
import { addSoundLayer, generatedSoundLayers, isSavedSoundPreset, removeSoundLayer, soundLayerCount, soundLayers, soundParameters, updateSoundFilter, updateSoundParameter, updateSoundWave } from './video-sound-parameters'

const recipe: RecipeSound = {
  id: 'tap9yv8r', label: 'Tap', kind: 'recipe', recipe: { layers: [
    { source: { type: 'sine', frequency: 523 }, envelope: { attack: 0, decay: .015, sustain: 0, release: .005 }, gain: .237 },
    { source: { type: 'sine', frequency: 784 }, envelope: { attack: 0, decay: .015, sustain: 0, release: .005 }, delay: .04, gain: .203 },
  ] },
}
const tone: GeneratedSound = {
  id: 'soft', label: 'Soft', kind: 'generated', wave: 'sine', frequency: .85, sweep: 1.06, duration: 1.25, filter: 1800, resonance: .4, gain: .8,
}

describe('sound preset parameter editing', () => {
  it('edits one layer without changing the built-in preset or other layers', () => {
    const original = JSON.stringify(recipe)
    const edited = updateSoundParameter(recipe, 1, 'startFrequency', 600) as RecipeSound
    expect(soundLayers(edited)[1]?.source).toEqual({ type: 'sine', frequency: { start: 600, end: 784 } })
    expect(soundLayers(edited)[0]).toEqual(soundLayers(recipe)[0])
    expect(JSON.stringify(recipe)).toBe(original)
  })

  it('converts milliseconds and percentages to the envelope values used for playback', () => {
    let edited = updateSoundParameter(recipe, 0, 'attack', 2.5)
    edited = updateSoundParameter(edited, 0, 'decay', 30)
    edited = updateSoundParameter(edited, 0, 'release', 12)
    edited = updateSoundParameter(edited, 0, 'sustain', 40)
    edited = updateSoundParameter(edited, 0, 'delay', 20)
    const layer = soundLayers(edited as RecipeSound)[0]
    expect(layer?.envelope).toEqual({ attack: .0025, decay: .03, release: .012, sustain: .4 })
    expect(layer?.delay).toBe(.02)
  })

  it('shows only parameters that apply to noise and restores pitch controls for an oscillator', () => {
    const noise = updateSoundWave(recipe, 0, 'noise')
    expect(soundParameters(noise).map(field => field.key)).not.toContain('startFrequency')
    const oscillator = updateSoundWave(noise, 0, 'triangle') as RecipeSound
    expect(soundLayers(oscillator)[0]?.source).toEqual({ type: 'triangle', frequency: 440 })
    expect(soundParameters(oscillator).map(field => field.key)).toContain('startFrequency')
  })

  it('adds, tunes, and removes a layer filter', () => {
    let edited = updateSoundFilter(recipe, 0, 'bandpass')
    edited = updateSoundParameter(edited, 0, 'filter', 1250)
    edited = updateSoundParameter(edited, 0, 'resonance', 2.4)
    expect(soundLayers(edited as RecipeSound)[0]?.filter).toEqual({ type: 'bandpass', frequency: 1250, Q: 2.4 })
    edited = updateSoundFilter(edited, 0, 'off')
    expect(soundParameters(edited).map(field => field.key)).not.toContain('filter')
    expect(soundLayers(recipe)[0]?.filter).toBeUndefined()
  })

  it('edits motion-based presets without changing their sound format', () => {
    const edited = updateSoundParameter(updateSoundWave(tone, 0, 'triangle'), 0, 'frequency', 1.2)
    expect(edited).toEqual({ ...tone, wave: 'triangle', frequency: 1.2 })
    expect(tone.frequency).toBe(.85)
    expect(updateSoundWave(tone, 0, 'noise')).toBe(tone)
  })

  it('ignores invalid input and keeps pitch positive', () => {
    expect(updateSoundParameter(recipe, 0, 'gain', Number.NaN)).toBe(recipe)
    const edited = updateSoundParameter(recipe, 0, 'endFrequency', -100) as RecipeSound
    expect(soundLayers(edited)[0]?.source).toEqual({ type: 'sine', frequency: { start: 523, end: 20 } })
  })

  it.each([recipe, tone])('reloads saved $kind presets with their edited values', (preset) => {
    const edited = updateSoundParameter(preset, 0, 'gain', .5)
    const saved = JSON.parse(JSON.stringify({ ...edited, id: 'saved-test', label: 'Saved 1' }))
    expect(isSavedSoundPreset(saved)).toBe(true)
    expect(soundParameters(saved).find(field => field.key === 'gain')?.value).toBe(.5)
  })

  it('still loads older saved recipes and skips incomplete data', () => {
    expect(isSavedSoundPreset({ ...recipe, id: 'saved-old', recipe: soundLayers(recipe)[0] })).toBe(true)
    expect(isSavedSoundPreset({ id: 'saved-invalid', label: 'Broken', kind: 'recipe', recipe: {} })).toBe(false)
    expect(isSavedSoundPreset({ ...tone, id: 'saved-invalid', frequency: null })).toBe(false)
    expect(isSavedSoundPreset({ ...recipe, id: 'saved-invalid', recipe: { layers: [] } })).toBe(false)
  })

  it.each([recipe, tone])('adds editable layers to $kind presets without changing the original', (preset) => {
    const original = JSON.stringify(preset)
    const count = soundLayerCount(preset)
    const added = addSoundLayer(preset)
    expect(soundLayerCount(added)).toBe(count + 1)
    const edited = updateSoundParameter(updateSoundWave(added, count, 'triangle'), count, 'gain', .35)
    expect(soundParameters(edited, count).find(field => field.key === 'gain')?.value).toBe(.35)
    expect(soundParameters(edited, 0)).toEqual(soundParameters(preset, 0))
    expect(JSON.stringify(preset)).toBe(original)
    expect(isSavedSoundPreset(JSON.parse(JSON.stringify({ ...edited, id: 'saved-layers' })))).toBe(true)
  })

  it('can add a layer to a single-layer recipe', () => {
    const single: RecipeSound = { ...recipe, recipe: soundLayers(recipe)[0]! }
    const added = addSoundLayer(single) as RecipeSound
    expect(soundLayers(added)).toHaveLength(2)
    expect(soundLayers(added)[0]).toEqual(single.recipe)
    expect(soundLayers(single)).toHaveLength(1)
  })

  it.each([recipe, tone])('removes the selected $kind layer while preserving the remaining settings', (preset) => {
    const added = addSoundLayer(preset)
    const nextLayerFields = soundParameters(added, 1)
    const removed = removeSoundLayer(added, 0)
    expect(soundLayerCount(removed)).toBe(soundLayerCount(added) - 1)
    expect(soundParameters(removed, 0)).toEqual(nextLayerFields)
    expect(removed.id).toBe(preset.id)
    expect(isSavedSoundPreset(JSON.parse(JSON.stringify({ ...removed, id: 'saved-removed' })))).toBe(true)
  })

  it.each([recipe, tone])('keeps one $kind layer and ignores invalid removal indexes', (preset) => {
    let remaining = preset
    while (soundLayerCount(remaining) > 1) remaining = removeSoundLayer(remaining, 0)
    expect(removeSoundLayer(remaining, 0)).toBe(remaining)
    for (const index of [-1, .5, Number.NaN, 100]) expect(removeSoundLayer(preset, index)).toBe(preset)
  })

  it('keeps every motion-based layer available to the preview and export scheduler', () => {
    const added = addSoundLayer(addSoundLayer(tone))
    const edited = updateSoundParameter(added, 2, 'frequency', 2) as GeneratedSound
    expect(generatedSoundLayers(edited).map(layer => layer.frequency)).toEqual([.85, 1, 2])
    const removed = removeSoundLayer(edited, 1) as GeneratedSound
    expect(generatedSoundLayers(removed).map(layer => layer.frequency)).toEqual([.85, 2])
  })

  it('rejects invalid extra layers when loading saved presets', () => {
    expect(isSavedSoundPreset({ ...tone, id: 'saved-invalid', additionalLayers: [{}] })).toBe(false)
    expect(isSavedSoundPreset({ ...tone, id: 'saved-invalid', additionalLayers: {} })).toBe(false)
  })
})
