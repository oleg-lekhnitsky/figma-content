type CuratedRecipeSoundId = 'tap9yv8r' | 'hover5e7n3' | 'hover2hpde' | 'transitionQ95m7' | 'transition2p0j7' | 'tap6031h'
export type GeneratedRecipeSoundId = `generated-${number}`
export type SavedRecipeSoundId = `saved-${string}`
export type RecipeSoundId = CuratedRecipeSoundId | GeneratedRecipeSoundId | SavedRecipeSoundId
export type SoundId = RecipeSoundId | 'soft' | 'glass' | 'pulse' | 'digital'
export type SoundWave = 'sine' | 'triangle' | 'square' | 'sawtooth'
export type GeneratedSound = {
  id: Exclude<SoundId, RecipeSoundId> | SavedRecipeSoundId
  label: string
  kind: 'generated'
  wave: SoundWave
  frequency: number
  sweep: number
  duration: number
  filter: number
  resonance: number
  gain: number
}
export type RecipeLayer = {
  source: {
    type: SoundWave
    frequency: number | { start: number, end: number }
  } | {
    type: 'noise'
    color: 'white'
  }
  envelope: {
    attack: number
    decay: number
    sustain: number
    release: number
    curve?: 'ramp'
  }
  delay?: number
  gain: number
  filter?: {
    type: BiquadFilterType
    frequency: number
    Q: number
  }
}
export type SoundRecipe = RecipeLayer | { layers: RecipeLayer[] }
export type RecipeSound = {
  id: RecipeSoundId
  label: string
  kind: 'recipe'
  recipe: SoundRecipe
}
export type SoundPreset = RecipeSound | GeneratedSound
