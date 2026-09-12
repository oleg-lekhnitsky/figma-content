<script setup lang="ts">
import { MoreH } from 'reicon-vue'
import type { VideoComposerSettings, VideoTemplate } from '~/types/video-composer'
import type { VideoExportAudioSession } from '~/composables/useVideoComposer'
import AppDropdownMenu from '~/components/AppDropdownMenu.vue'
import VideoRangeInput from '~/components/video-composer/VideoRangeInput.vue'
import { requestVideoAudioPlayback, resumeVideoAudioContext } from '~/utils/video-audio-playback'
import { createVideoAccentEvents, type VideoMainSoundKind as MainSoundKind, type VideoKickKind, type VideoSoundEvent as SoundEvent } from '~/utils/video-accent-events'

const props = defineProps<{
  settings: VideoComposerSettings
  template: VideoTemplate
  playing: boolean
  progress: number
  duration: number
  assetCount: number
}>()

const enabled = ref(false)
const volume = ref(28)
const firstAccentEnabled = ref(true)
const finalAccentEnabled = ref(true)
type KickPattern = 'off' | 'accents' | 'four-floor' | 'eight-floor' | 'sixteen-floor'
const kickPattern = ref<KickPattern>('off')
const kickPatternOpen = ref(false)
const kickPatternOptions: ReadonlyArray<{ value: KickPattern, label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'accents', label: 'Accents' },
  { value: 'four-floor', label: '4' },
  { value: 'eight-floor', label: '8' },
  { value: 'sixteen-floor', label: '16' },
]
const kickPatternLabel = computed(() => kickPatternOptions.find(option => option.value === kickPattern.value)?.label)
const kickPatternBeatCounts: Record<KickPattern, number> = {
  off: 0,
  accents: 0,
  'four-floor': 4,
  'eight-floor': 8,
  'sixteen-floor': 16,
}
type TransitionBeatCount = 0 | 3 | 4 | 8 | 16
const transitionBeats = ref<TransitionBeatCount>(4)
const transitionBeatOptions: ReadonlyArray<{ value: TransitionBeatCount, label: string }> = [
  { value: 0, label: 'Off' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 8, label: '8' },
  { value: 16, label: '16' },
]
type CuratedRecipeSoundId = 'tap9yv8r' | 'hover5e7n3' | 'hover2hpde' | 'transitionQ95m7' | 'transition2p0j7' | 'tap6031h'
type GeneratedRecipeSoundId = `generated-${number}`
type SavedRecipeSoundId = `saved-${string}`
type RecipeSoundId = CuratedRecipeSoundId | GeneratedRecipeSoundId | SavedRecipeSoundId
type SoundId = RecipeSoundId | 'soft' | 'glass' | 'pulse' | 'digital'
type GeneratedSound = {
  id: Exclude<SoundId, RecipeSoundId>
  label: string
  kind: 'generated'
  wave: OscillatorType
  frequency: number
  sweep: number
  duration: number
  filter: number
  resonance: number
  gain: number
}
type RecipeLayer = {
  source: {
    type: OscillatorType
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
type SoundRecipe = RecipeLayer | { layers: RecipeLayer[] }
type RecipeSound = {
  id: RecipeSoundId
  label: string
  kind: 'recipe'
  recipe: SoundRecipe
}

const soundId = ref<SoundId>('tap9yv8r')
const soundActionsId = ref<SoundId | null>(null)
let context: AudioContext | undefined
let releaseAudioPlayback: (() => void) | undefined
let previousProgress = 0
let previousEvent = -1

const tap9yv8r: SoundRecipe = {
  layers: [
    {
      source: { type: 'sine', frequency: 523 },
      envelope: { attack: 0, decay: .015, sustain: 0, release: .005 },
      gain: .237,
    },
    {
      source: { type: 'sine', frequency: 784 },
      envelope: { attack: 0, decay: .015, sustain: 0, release: .005 },
      delay: .04,
      gain: .203,
    },
  ],
}
const hover5e7n3: SoundRecipe = {
  source: { type: 'noise', color: 'white' },
  envelope: { attack: .0005, decay: .01, sustain: 0, release: .004 },
  gain: 3,
  filter: { type: 'bandpass', frequency: 2469.04064806205, Q: 42 },
}
const hover2hpde: SoundRecipe = {
  source: { type: 'sine', frequency: 1223.284 },
  envelope: { attack: 0, decay: .008, sustain: 0, release: .003, curve: 'ramp' },
  gain: .222,
  filter: { type: 'lowpass', frequency: 1127, Q: .711 },
}
const transitionQ95m7: SoundRecipe = {
  layers: [
    {
      source: { type: 'noise', color: 'white' },
      filter: { type: 'bandpass', frequency: 2200, Q: 1.6 },
      envelope: { attack: .001, decay: .016, sustain: 0, release: 0, curve: 'ramp' },
      gain: .675,
      delay: .024,
    },
    {
      source: { type: 'noise', color: 'white' },
      filter: { type: 'bandpass', frequency: 3800, Q: 1.6 },
      envelope: { attack: .001, decay: .02, sustain: 0, release: 0, curve: 'ramp' },
      gain: .562,
    },
  ],
}
const transition2p0j7: SoundRecipe = {
  source: { type: 'sine', frequency: 466.508 },
  envelope: { attack: 0, decay: .012, sustain: 0, release: .004 },
  gain: .28,
  filter: { type: 'lowpass', frequency: 1614.0409077697868, Q: 2.488935898146523 },
}
const tap6031h: SoundRecipe = {
  layers: [
    {
      source: { type: 'sine', frequency: { start: 177.673, end: 222.092 } },
      envelope: { attack: 0, decay: .03, sustain: 0, release: .01 },
      gain: .17,
      filter: { type: 'lowpass', frequency: 459.28312887600936, Q: 2.3788767244197975 },
    },
    {
      source: { type: 'sine', frequency: { start: 88.837, end: 111.046 } },
      envelope: { attack: 0, decay: .03, sustain: 0, release: .01 },
      gain: .094,
      delay: .035181697227096694,
      filter: { type: 'lowpass', frequency: 300, Q: 2.469354115270542 },
    },
  ],
}

const tapSound: RecipeSound = { id: 'tap9yv8r', label: 'Tap 9yv8r', kind: 'recipe', recipe: tap9yv8r }
const sounds: ReadonlyArray<RecipeSound | GeneratedSound> = [
  tapSound,
  { id: 'hover5e7n3', label: 'Hover 5e7n3', kind: 'recipe', recipe: hover5e7n3 },
  { id: 'hover2hpde', label: 'Hover 2hpde', kind: 'recipe', recipe: hover2hpde },
  { id: 'transitionQ95m7', label: 'Transition Q95m7', kind: 'recipe', recipe: transitionQ95m7 },
  { id: 'transition2p0j7', label: 'Transition 2p0j7', kind: 'recipe', recipe: transition2p0j7 },
  { id: 'tap6031h', label: 'Tap 6031h', kind: 'recipe', recipe: tap6031h },
  { id: 'soft', label: 'Soft', kind: 'generated', wave: 'sine', frequency: .85, sweep: 1.06, duration: 1.25, filter: 1800, resonance: .4, gain: .8 },
  { id: 'glass', label: 'Glass', kind: 'generated', wave: 'sine', frequency: 1.65, sweep: 1.35, duration: 1.5, filter: 6000, resonance: 5, gain: .65 },
  { id: 'pulse', label: 'Pulse', kind: 'generated', wave: 'square', frequency: .82, sweep: 1.12, duration: .7, filter: 2400, resonance: .8, gain: .65 },
  { id: 'digital', label: 'Digital', kind: 'generated', wave: 'sawtooth', frequency: 1.25, sweep: 1.28, duration: .5, filter: 3400, resonance: 2, gain: .55 },
]
const generatedSounds = shallowRef<RecipeSound[]>([])
const savedSounds = shallowRef<RecipeSound[]>([])
const generatedCount = ref(0)
const savedSoundsStorageKey = 'figma-content.video-procedural-audio.saved-sounds.v1'
const soundOptionsElement = ref<HTMLElement | null>(null)
let soundOptionsScrollBeforePointer = 0
const soundOptions = computed<ReadonlyArray<RecipeSound | GeneratedSound>>(() => (
  [...sounds, ...savedSounds.value, ...generatedSounds.value]
))
const sound = computed(() => soundOptions.value.find(option => option.id === soundId.value) ?? tapSound)
const isGeneratedRecipe = (option: RecipeSound | GeneratedSound): option is RecipeSound => option.kind === 'recipe' && option.id.startsWith('generated-')
const isSavedRecipe = (option: RecipeSound | GeneratedSound): option is RecipeSound => option.kind === 'recipe' && option.id.startsWith('saved-')

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))
const cycleCount = computed(() => Math.max(.01, props.settings.cycles))
const cycleLabel = computed(() => Number(cycleCount.value.toFixed(2)).toString())
const easingCurves: Record<VideoComposerSettings['easing'], readonly [number, number, number, number]> = {
  flow: [.2, 0, .2, 1],
  glide: [.33, 0, 0, 1],
  linear: [0, 0, 1, 1],
  ease: [.25, .1, .25, 1],
  sweep: [.86, .14, .14, .86],
  smooth: [.76, 0, .24, 1],
}
const cubicBezierProgress = (progress: number, [x1, y1, x2, y2]: readonly [number, number, number, number]) => {
  if (progress <= 0 || progress >= 1 || (x1 === y1 && x2 === y2)) return progress
  const sample = (time: number, first: number, second: number) => ((1 - 3 * second + 3 * first) * time + (3 * second - 6 * first)) * time * time + 3 * first * time
  let low = 0
  let high = 1
  let time = progress
  for (let iteration = 0; iteration < 20; iteration += 1) {
    time = (low + high) / 2
    if (sample(time, x1, x2) < progress) low = time
    else high = time
  }
  return sample(time, y1, y2)
}
const inverseEasedProgress = (target: number, curve: readonly [number, number, number, number]) => {
  let low = 0
  let high = 1
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const midpoint = (low + high) / 2
    if (cubicBezierProgress(midpoint, curve) < target) low = midpoint
    else high = midpoint
  }
  return (low + high) / 2
}
const motionCurve = computed(() => {
  const collection = props.template.collection
  if (collection === 'grid' || collection === 'test') return easingCurves[props.settings.easing]
  if (collection === 'flicker' && props.settings.flickerEffect === 'flip') return easingCurves[props.settings.easing]
  return props.template.bezier ?? easingCurves[props.settings.easing]
})
type MotionWindow = {
  start: number
  duration: number
  curve: readonly [number, number, number, number]
}
const cueSchedule = computed(() => {
  const assetCount = Math.max(1, props.assetCount)
  const visibleCount = Math.max(1, Math.round(props.settings.visibleCount))
  const duration = Math.max(.12, props.settings.secondsPerSlide)
  const cycles = cycleCount.value
  const collection = props.template.collection
  const timelineDuration = Math.max(.12, props.duration)
  const times: number[] = []
  const windows: MotionWindow[] = []
  let spacing = duration
  const add = (time: number) => {
    if (time > .001 && time < timelineDuration - .001 && times.length < 1200) times.push(time)
  }
  const repeat = (first: number, span: number) => {
    spacing = Math.max(.001, span)
    for (let time = first; time < timelineDuration - .001 && times.length < 1200; time += spacing) add(time)
  }
  const addMotion = (start: number, motionDuration: number, curve = motionCurve.value) => {
    if (start < timelineDuration - .001 && windows.length < 1200) windows.push({ start, duration: motionDuration, curve })
    add(start + motionDuration * inverseEasedProgress(.995, curve))
  }
  const repeatMotion = (first: number, span: number, motionDuration: number, curve = motionCurve.value) => {
    spacing = Math.max(.001, span)
    for (let start = first; start < timelineDuration - .001 && windows.length < 1200; start += spacing) addMotion(start, motionDuration, curve)
  }

  if (collection === 'flicker') {
    const count = Math.min(30, visibleCount)
    const slotDuration = duration / count
    const delay = Math.min(slotDuration * .95, Math.max(0, props.settings.delaySeconds))
    const activeRatio = (slotDuration - delay) / slotDuration
    spacing = slotDuration
    if (props.settings.flickerPacing === 'eased') {
      const boundaries = Array.from({ length: count + 1 }, (_, index) => inverseEasedProgress(index / count, motionCurve.value))
      const cycleTotal = Math.max(1, Math.ceil(timelineDuration / duration))
      for (let cycle = 0; cycle < cycleTotal; cycle += 1) {
        for (let index = 0; index < count; index += 1) {
          const start = (boundaries[index] ?? 0) * duration
          const end = (boundaries[index + 1] ?? 1) * duration
          if (props.settings.flickerEffect === 'off') add(cycle * duration + start)
          else addMotion(cycle * duration + start, (end - start) * activeRatio)
        }
      }
    } else if (props.settings.flickerEffect === 'off') repeat(slotDuration, slotDuration)
    else repeatMotion(0, slotDuration, slotDuration - delay)
  } else if (collection === 'test') {
    const count = Math.min(30, visibleCount, Math.max(2, assetCount))
    const slotDuration = duration / count
    const delay = Math.min(slotDuration * .95, Math.max(0, props.settings.delaySeconds))
    const activeDuration = Math.max(.001, slotDuration - delay)
    const gridCount = Math.max(1, Math.round(props.settings.flipGridColumns) * Math.round(props.settings.flipGridRows))
    const lastCellDelay = Math.max(0, gridCount - 1) * Math.max(0, props.settings.flipStagger)
    repeatMotion(0, slotDuration, lastCellDelay + activeDuration)
  } else if (collection === 'stories') {
    const count = Math.min(12, Math.max(3, visibleCount))
    const slotDuration = duration / count
    const delay = Math.min(slotDuration * .95, Math.max(0, props.settings.delaySeconds))
    const activeDuration = slotDuration - delay
    repeatMotion(delay, slotDuration, activeDuration)
  } else if (collection === 'carousel') {
    const activeDuration = duration / cycles
    repeatMotion(Math.max(0, props.settings.delayFrames) / 30, activeDuration, activeDuration)
  } else if (collection === 'carousel-3d') {
    repeatMotion(Math.max(0, props.settings.delayFrames) / 30, duration, duration)
  } else if (collection === 'orbit') {
    const activeDuration = duration / (cycles * visibleCount)
    repeatMotion(0, activeDuration + Math.max(0, props.settings.delaySeconds), activeDuration)
  } else if (collection === 'globe' && props.settings.globeMotion === 'stepped') {
    const stopCount = Math.max(1, Math.min(visibleCount, Math.round(props.settings.globeStops)))
    const stepCount = Math.max(1, Math.round(cycles * stopCount))
    const transitionDuration = duration / stepCount
    const delay = Math.max(0, props.settings.delaySeconds)
    repeatMotion(delay, transitionDuration + delay, transitionDuration)
  } else if (collection === 'globe') {
    repeatMotion(Math.max(0, props.settings.delaySeconds), duration, duration)
  } else if (collection === 'swipe-depth') {
    const activeDuration = duration / (visibleCount * cycles)
    repeatMotion(Math.max(0, props.settings.delayFrames) / 30, activeDuration, activeDuration)
  } else if (collection === 'scale') {
    const count = Math.max(1, Math.min(20, Math.floor(visibleCount)))
    const stagger = Math.max(.02, props.settings.staggerSeconds)
    const transitionDuration = Math.min(duration, Math.max(1, count - 1) * stagger)
    repeatMotion(0, stagger, transitionDuration)
  } else if (collection === 'grid') {
    const delay = props.settings.gridLayout === 'tube' && props.settings.gridTubeMotion === 'continuous'
      ? 0
      : Math.max(0, props.settings.delaySeconds)
    repeatMotion(0, duration + delay, duration)
  } else if (props.settings.transition === 'cut') {
    repeat(duration, duration)
  } else {
    repeatMotion(duration * .78, duration, duration * .22, easingCurves.linear)
  }

  return { times: times.sort((left, right) => left - right), windows, spacing }
})
const stepDuration = computed(() => cueSchedule.value.spacing)

const randomBetween = (minimum: number, maximum: number) => minimum + Math.random() * (maximum - minimum)
const rounded = (value: number, precision = 3) => Number(value.toFixed(precision))
function randomItem<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)] as T
}

const createGeneratedRecipe = (): SoundRecipe => {
  const collection = props.template.collection
  const baseFrequency = {
    flicker: 520,
    stories: 330,
    grid: 210,
    orbit: 250,
    globe: 220,
    scale: 390,
    'carousel-3d': 280,
    'swipe-depth': 300,
    carousel: 350,
    test: 430,
  }[collection ?? 'carousel'] ?? 350
  const rising = ['up', 'right'].includes(props.settings.direction) !== props.settings.reverse
  const root = clamp(baseFrequency * randomBetween(.72, 1.45), 120, 900)
  const sweep = randomBetween(1.04, 1.32)
  const startFrequency = rising ? root / sweep : root * sweep
  const endFrequency = rising ? root * sweep : root / sweep
  const decay = clamp(stepDuration.value * randomBetween(.025, .065), .014, .075)
  const release = randomBetween(.003, .014)
  const layers: RecipeLayer[] = [{
    source: {
      type: randomItem<OscillatorType>(['sine', 'triangle']),
      frequency: { start: rounded(startFrequency), end: rounded(endFrequency) },
    },
    envelope: { attack: rounded(randomBetween(0, .003), 4), decay: rounded(decay, 4), sustain: 0, release: rounded(release, 4), curve: 'ramp' },
    gain: rounded(randomBetween(.13, .26)),
    filter: {
      type: 'lowpass',
      frequency: rounded(clamp(root * randomBetween(2.4, 5.2), 500, 4200)),
      Q: rounded(randomBetween(.5, 3.2)),
    },
  }]

  if (Math.random() < .55) {
    const interval = randomItem([1.25, 4 / 3, 1.5, 2])
    const companionRoot = clamp(root * interval, 150, 1600)
    layers.push({
      source: { type: 'sine', frequency: companionRoot },
      envelope: { attack: 0, decay: rounded(decay * randomBetween(.65, 1.05), 4), sustain: 0, release: rounded(release, 4), curve: 'ramp' },
      delay: rounded(randomBetween(.012, .042), 4),
      gain: rounded(randomBetween(.06, .15)),
      filter: { type: 'lowpass', frequency: rounded(clamp(companionRoot * 3, 600, 4400)), Q: rounded(randomBetween(.4, 2.4)) },
    })
  }

  if (Math.random() < .38) {
    layers.push({
      source: { type: 'noise', color: 'white' },
      envelope: { attack: .001, decay: rounded(randomBetween(.008, .024), 4), sustain: 0, release: rounded(randomBetween(.002, .006), 4), curve: 'ramp' },
      delay: rounded(randomBetween(0, .018), 4),
      gain: rounded(randomBetween(.1, .28)),
      filter: { type: 'bandpass', frequency: rounded(randomBetween(1100, 3600)), Q: rounded(randomBetween(1.2, 4.5)) },
    })
  }

  return layers.length === 1 ? layers[0] as RecipeLayer : { layers }
}

const soundEvents = computed(() => {
  const events = createVideoAccentEvents(cueSchedule.value.times, {
    firstAccent: firstAccentEnabled.value,
    finalAccent: finalAccentEnabled.value,
    kick: kickPattern.value === 'accents',
  })
  if (transitionBeats.value > 0) {
    cueSchedule.value.windows.forEach((window, step) => {
      for (let beat = 1; beat <= transitionBeats.value; beat += 1) {
        const visualProgress = beat / (transitionBeats.value + 1)
        const time = window.start + window.duration * inverseEasedProgress(visualProgress, window.curve)
        if (time > .001 && time < props.duration - .001) events.push({ time, step, kind: 'transition' })
      }
    })
  }
  const kickBeatsPerCycle = kickPatternBeatCounts[kickPattern.value]
  if (kickBeatsPerCycle > 0) {
    const cycleDuration = props.duration / cycleCount.value
    const kickSpacing = cycleDuration / kickBeatsPerCycle
    for (let time = 0, step = 0; time < props.duration - .001; time += kickSpacing, step += 1) {
      events.push({ time, step, kind: 'kick', kickKind: 'rhythm' })
    }
  }
  return events.sort((left, right) => left.time - right.time || Number(right.kind === 'transition') - Number(left.kind === 'transition'))
})
const eventIndexAt = (progress: number) => {
  let low = 0
  let high = soundEvents.value.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if ((soundEvents.value[middle]?.time ?? Number.POSITIVE_INFINITY) <= progress + .001) low = middle + 1
    else high = middle
  }
  return low - 1
}

const ensureContext = async () => {
  releaseAudioPlayback ??= requestVideoAudioPlayback()
  const audio = context ??= new AudioContext()
  await resumeVideoAudioContext(audio)
  return audio
}

const resume = async () => {
  if (enabled.value) await ensureContext()
}

const toneFor = (step: number, selectedSound: GeneratedSound, kind: MainSoundKind, outputVolume = volume.value) => {
  const collection = props.template.collection
  const baseFrequency = {
    flicker: 270,
    stories: 190,
    grid: 125,
    orbit: 150,
    globe: 135,
    scale: 220,
    'carousel-3d': 165,
    'swipe-depth': 175,
    carousel: 205,
    test: 240,
  }[collection ?? 'carousel'] ?? 205
  const intervals = [0, 3, 7, 10]
  const pitchScale = kind === 'transition' ? .84 : 1
  const gainScale = kind === 'transition' ? .32 : 1
  const durationScale = kind === 'transition' ? .55 : 1
  const frequency = baseFrequency * selectedSound.frequency * pitchScale * 2 ** ((intervals[step % intervals.length] ?? 0) / 12)
  const rising = ['up', 'right'].includes(props.settings.direction) !== props.settings.reverse
  const motion = Math.max(
    Math.abs(props.settings.driftAmount) / 200,
    Math.abs(props.settings.scaleAmount) / 100,
    Math.abs(props.settings.tilt) / 100,
    Math.abs(props.settings.distance) / 1000,
  )
  return {
    startFrequency: rising ? frequency / selectedSound.sweep : frequency * selectedSound.sweep,
    endFrequency: rising ? frequency * selectedSound.sweep : frequency / selectedSound.sweep,
    duration: clamp(stepDuration.value * .18 * selectedSound.duration * durationScale, .025, .24),
    gain: outputVolume / 100 * (.18 + clamp(motion, 0, 1) * .1) * selectedSound.gain * gainScale,
    wave: selectedSound.wave,
    filter: selectedSound.filter,
    resonance: selectedSound.resonance,
    pan: props.settings.direction === 'left' ? -.35 : props.settings.direction === 'right' ? .35 : 0,
  } as const
}

const playRecipe = (audio: AudioContext, recipe: SoundRecipe, kind: MainSoundKind, destination: AudioNode = audio.destination, when = audio.currentTime, outputVolume = volume.value) => {
  const now = when
  const pan = props.settings.direction === 'left' ? -.35 : props.settings.direction === 'right' ? .35 : 0
  const layers = 'layers' in recipe ? recipe.layers : [recipe]
  const gainScale = kind === 'transition' ? .32 : 1
  const pitchScale = kind === 'transition' ? .84 : 1

  for (const layer of layers) {
    const envelope = audio.createGain()
    const panner = audio.createStereoPanner()
    const start = now + (layer.delay ?? 0)
    const attackEnd = start + layer.envelope.attack
    const decayEnd = attackEnd + layer.envelope.decay
    const releaseEnd = decayEnd + layer.envelope.release
    const peakGain = layer.gain * outputVolume / 100 * gainScale
    const sustainGain = peakGain * layer.envelope.sustain
    let source: AudioScheduledSourceNode

    if (layer.source.type === 'noise') {
      const noise = audio.createBufferSource()
      const sampleCount = Math.max(1, Math.ceil(audio.sampleRate * (releaseEnd - start + .01)))
      const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate)
      const samples = buffer.getChannelData(0)
      for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1
      noise.buffer = buffer
      source = noise
    } else {
      const oscillator = audio.createOscillator()
      const frequency = layer.source.frequency
      oscillator.type = layer.source.type
      if (typeof frequency === 'number') {
        oscillator.frequency.setValueAtTime(frequency * pitchScale, start)
      } else {
        oscillator.frequency.setValueAtTime(frequency.start * pitchScale, start)
        oscillator.frequency.exponentialRampToValueAtTime(frequency.end * pitchScale, releaseEnd)
      }
      source = oscillator
    }

    panner.pan.value = pan
    envelope.gain.setValueAtTime(0, start)
    if (layer.envelope.attack > 0) envelope.gain.linearRampToValueAtTime(peakGain, attackEnd)
    else envelope.gain.setValueAtTime(peakGain, start)
    if (layer.envelope.decay > 0) envelope.gain.linearRampToValueAtTime(sustainGain, decayEnd)
    else envelope.gain.setValueAtTime(sustainGain, decayEnd)
    envelope.gain.linearRampToValueAtTime(0, releaseEnd)

    if (layer.filter) {
      const filter = audio.createBiquadFilter()
      filter.type = layer.filter.type
      filter.frequency.setValueAtTime(layer.filter.frequency * pitchScale, start)
      filter.Q.setValueAtTime(layer.filter.Q, start)
      source.connect(filter).connect(envelope)
    } else {
      source.connect(envelope)
    }
    envelope.connect(panner).connect(destination)
    source.start(start)
    source.stop(releaseEnd + .01)
  }
}

const playKick = (audio: AudioContext, kind: VideoKickKind, destination: AudioNode = audio.destination, when = audio.currentTime, outputVolume = volume.value) => {
  const now = when
  const duration = kind === 'start' ? .18 : kind === 'rhythm' ? .2 : .22
  const oscillator = audio.createOscillator()
  const filter = audio.createBiquadFilter()
  const envelope = audio.createGain()
  const panner = audio.createStereoPanner()
  const peakGain = outputVolume / 100 * (kind === 'start' ? .52 : kind === 'rhythm' ? .62 : .68)

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(kind === 'start' ? 96 : kind === 'rhythm' ? 104 : 110, now)
  oscillator.frequency.exponentialRampToValueAtTime(48, now + duration)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(240, now)
  filter.Q.setValueAtTime(.7, now)
  envelope.gain.setValueAtTime(Math.max(.0001, peakGain), now)
  envelope.gain.exponentialRampToValueAtTime(.0001, now + duration)
  panner.pan.value = props.settings.direction === 'left' ? -.12 : props.settings.direction === 'right' ? .12 : 0

  oscillator.connect(filter).connect(envelope).connect(panner).connect(destination)
  oscillator.start(now)
  oscillator.stop(now + duration + .01)
}

const scheduleGeneratedTone = (audio: AudioContext, step: number, selectedSound: GeneratedSound, kind: MainSoundKind, destination: AudioNode = audio.destination, when = audio.currentTime, outputVolume = volume.value) => {
  const tone = toneFor(step, selectedSound, kind, outputVolume)
  const oscillator = audio.createOscillator()
  const filter = audio.createBiquadFilter()
  const envelope = audio.createGain()
  const panner = audio.createStereoPanner()

  oscillator.type = tone.wave
  oscillator.frequency.setValueAtTime(Math.max(20, tone.startFrequency), when)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, tone.endFrequency), when + tone.duration)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(tone.filter + Math.min(2200, Math.abs(props.settings.fade) * 22), when)
  filter.Q.value = tone.resonance
  envelope.gain.setValueAtTime(.0001, when)
  envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, tone.gain), when + .008)
  envelope.gain.exponentialRampToValueAtTime(.0001, when + tone.duration)
  panner.pan.value = tone.pan

  oscillator.connect(filter).connect(envelope).connect(panner).connect(destination)
  oscillator.start(when)
  oscillator.stop(when + tone.duration + .01)
}

const scheduleMainTone = (audio: AudioContext, selectedSound: RecipeSound | GeneratedSound, step: number, kind: MainSoundKind, destination: AudioNode = audio.destination, when = audio.currentTime, outputVolume = volume.value) => {
  if (selectedSound.kind === 'recipe') {
    playRecipe(audio, selectedSound.recipe, kind, destination, when, outputVolume)
  } else {
    scheduleGeneratedTone(audio, step, selectedSound, kind, destination, when, outputVolume)
  }
}

const playTone = async (step: number, audition = false, kind: MainSoundKind = 'settle') => {
  if (!enabled.value || (!props.playing && !audition)) return
  const audio = await ensureContext()
  if (!enabled.value || (!props.playing && !audition)) return
  scheduleMainTone(audio, sound.value, step, kind)
}

const playScheduledKick = async (kind: VideoKickKind) => {
  if (!enabled.value || !props.playing) return
  const audio = await ensureContext()
  if (enabled.value && props.playing) playKick(audio, kind)
}

const auditionKickPattern = async (value: KickPattern) => {
  kickPattern.value = value
  previousEvent = -1
  if (value === 'off') return
  const audio = await ensureContext()
  playKick(audio, value === 'accents' ? 'settle' : 'rhythm')
}

const playScheduledEvent = (event: SoundEvent) => {
  if (event.kind === 'kick') void playScheduledKick(event.kickKind)
  else void playTone(event.step, false, event.kind)
}

const playCycleStart = () => {
  for (const event of soundEvents.value) {
    if (event.time > 0) break
    playScheduledEvent(event)
  }
}

const setEnabled = async (value: boolean) => {
  enabled.value = value
  previousEvent = -1
  if (!value) {
    soundActionsId.value = null
    kickPatternOpen.value = false
    releaseAudioPlayback?.()
    releaseAudioPlayback = undefined
    return
  }
  await ensureContext()
  const event = soundEvents.value[Math.max(0, eventIndexAt(props.progress))]
  if (!props.playing) void playTone(event?.step ?? 0, true, finalAccentEnabled.value ? 'settle' : 'transition')
}

const rememberSoundOptionsScroll = () => {
  soundOptionsScrollBeforePointer = soundOptionsElement.value?.scrollTop ?? 0
}

const selectSound = (id: SoundId, clickEvent: MouseEvent) => {
  const pointerScrollTop = clickEvent.detail > 0 ? soundOptionsScrollBeforePointer : null
  soundId.value = id
  previousEvent = -1
  const cue = soundEvents.value[Math.max(0, eventIndexAt(props.progress))]
  void playTone(cue?.step ?? 0, true, finalAccentEnabled.value ? 'settle' : 'transition')
  if (pointerScrollTop !== null) {
    void nextTick(() => {
      const element = soundOptionsElement.value
      if (element) element.scrollTop = pointerScrollTop
    })
  }
}

const generateSound = () => {
  generatedCount.value += 1
  const generatedSound: RecipeSound = {
    id: `generated-${generatedCount.value}`,
    label: `Generated ${generatedCount.value}`,
    kind: 'recipe',
    recipe: createGeneratedRecipe(),
  }
  generatedSounds.value = [...generatedSounds.value, generatedSound]
  soundId.value = generatedSound.id
  previousEvent = -1
  const event = soundEvents.value[Math.max(0, eventIndexAt(props.progress))]
  void playTone(event?.step ?? 0, true, finalAccentEnabled.value ? 'settle' : 'transition')
  void nextTick(() => {
    const element = soundOptionsElement.value
    if (element) element.scrollTop = element.scrollHeight
  })
}

const persistSavedSounds = () => {
  try {
    localStorage.setItem(savedSoundsStorageKey, JSON.stringify(savedSounds.value))
  } catch {
    // Saving is optional when browser storage is unavailable.
  }
}

const restoreSoundFocus = (id: SoundId, scrollTop: number) => {
  soundActionsId.value = null
  void nextTick(() => {
    const element = soundOptionsElement.value
    if (!element) return
    element.scrollTop = scrollTop
    element.querySelector<HTMLButtonElement>(`[data-sound-id="${id}"] .video-sound-option-select`)?.focus({ preventScroll: true })
  })
}

const saveSound = (generatedSound: RecipeSound | GeneratedSound) => {
  if (!isGeneratedRecipe(generatedSound)) return
  const scrollTop = soundOptionsElement.value?.scrollTop ?? 0
  const savedNumber = savedSounds.value.reduce((maximum, option) => {
    const match = option.label.match(/^Saved (\d+)$/)
    return Math.max(maximum, Number(match?.[1] ?? 0))
  }, 0) + 1
  const savedSound: RecipeSound = {
    ...generatedSound,
    id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: `Saved ${savedNumber}`,
  }
  savedSounds.value = [...savedSounds.value, savedSound]
  generatedSounds.value = generatedSounds.value.filter(option => option.id !== generatedSound.id)
  soundId.value = savedSound.id
  persistSavedSounds()
  restoreSoundFocus(savedSound.id, scrollTop)
}

const deleteSound = (customSound: RecipeSound | GeneratedSound) => {
  if (!isGeneratedRecipe(customSound) && !isSavedRecipe(customSound)) return
  const scrollTop = soundOptionsElement.value?.scrollTop ?? 0
  const wasSelected = soundId.value === customSound.id
  const currentIndex = soundOptions.value.findIndex(option => option.id === customSound.id)
  generatedSounds.value = generatedSounds.value.filter(option => option.id !== customSound.id)
  const wasSaved = savedSounds.value.some(option => option.id === customSound.id)
  if (wasSaved) {
    savedSounds.value = savedSounds.value.filter(option => option.id !== customSound.id)
    persistSavedSounds()
  }
  const remainingOptions = [...sounds, ...savedSounds.value, ...generatedSounds.value]
  const nextSound = remainingOptions[Math.min(currentIndex, remainingOptions.length - 1)] ?? tapSound
  if (wasSelected) {
    soundId.value = nextSound.id
    previousEvent = -1
  }
  restoreSoundFocus(nextSound.id, scrollTop)
}

const createExportSession = async (): Promise<VideoExportAudioSession | undefined> => {
  if (!enabled.value) return undefined
  const audio = new AudioContext()
  const destination = audio.createMediaStreamDestination()
  await resumeVideoAudioContext(audio)
  const selectedSound = sound.value
  const outputVolume = volume.value
  const events = soundEvents.value.map(event => ({ ...event }))
  let started = false
  let startTime = 0
  let nextEvent = 0

  const scheduleThrough = (progress: number) => {
    if (!started) return
    while (nextEvent < events.length && (events[nextEvent]?.time ?? Number.POSITIVE_INFINITY) <= progress) {
      const event = events[nextEvent]
      nextEvent += 1
      if (!event) continue
      const when = Math.max(audio.currentTime + .002, startTime + event.time)
      if (event.kind === 'kick') playKick(audio, event.kickKind, destination, when, outputVolume)
      else scheduleMainTone(audio, selectedSound, event.step, event.kind, destination, when, outputVolume)
    }
  }

  return {
    stream: destination.stream,
    tailDurationMs: 240,
    start: () => {
      if (started) return
      started = true
      startTime = audio.currentTime + .015
      scheduleThrough(.25)
    },
    advance: progress => scheduleThrough(progress + .25),
    dispose: async () => {
      destination.stream.getTracks().forEach(track => track.stop())
      if (audio.state !== 'closed') await audio.close()
    },
  }
}

defineExpose({ createExportSession, resume })

watch(
  () => [props.playing, props.progress, enabled.value, soundEvents.value] as const,
  ([playing, progress, isEnabled, schedule], [wasPlaying, , wasEnabled, previousSchedule]) => {
    const eventIndex = eventIndexAt(progress)
    if (!playing || !isEnabled || !wasPlaying || !wasEnabled || schedule !== previousSchedule) {
      previousEvent = eventIndex
      previousProgress = progress
      if (playing && isEnabled && wasPlaying === false && progress <= .12) playCycleStart()
      return
    }
    if (progress + .04 < previousProgress) {
      previousEvent = eventIndex
      previousProgress = progress
      if (progress <= .12) playCycleStart()
      return
    }
    if (eventIndex > previousEvent) {
      const earliestAudibleTime = Math.max(previousProgress - .01, progress - .12)
      for (let index = previousEvent + 1; index <= eventIndex; index += 1) {
        const event = schedule[index]
        if (event && event.time >= earliestAudibleTime) playScheduledEvent(event)
      }
      previousEvent = eventIndex
    }
    previousProgress = progress
  },
)

onMounted(() => {
  try {
    const storedSounds = JSON.parse(localStorage.getItem(savedSoundsStorageKey) ?? '[]') as unknown
    if (!Array.isArray(storedSounds)) return
    savedSounds.value = storedSounds.filter((option): option is RecipeSound => {
      if (!option || typeof option !== 'object') return false
      const candidate = option as Partial<RecipeSound>
      return typeof candidate.id === 'string'
        && candidate.id.startsWith('saved-')
        && typeof candidate.label === 'string'
        && candidate.kind === 'recipe'
        && !!candidate.recipe
        && typeof candidate.recipe === 'object'
    })
  } catch {
    savedSounds.value = []
  }
})

onBeforeUnmount(() => {
  if (context) void context.close()
  context = undefined
  releaseAudioPlayback?.()
  releaseAudioPlayback = undefined
})
</script>

<template>
  <fieldset class="video-procedural-audio">

    <div class="video-choice-row">
      <button type="button" :aria-pressed="!enabled" @click="setEnabled(false)">Off</button>
      <button type="button" :aria-pressed="enabled" @click="setEnabled(true)">Procedural</button>
    </div>
    <fieldset v-if="enabled" class="video-sound-character">
      <legend>Sound preset</legend>
      <div ref="soundOptionsElement" class="video-sound-options" role="radiogroup" aria-label="Sound preset">
        <div v-for="option in soundOptions" :key="option.id" :data-sound-id="option.id" class="video-sound-option" :class="{ 'is-selected': soundId === option.id }">
          <button class="video-sound-option-select" type="button" role="radio" :aria-checked="soundId === option.id" @pointerdown="rememberSoundOptionsScroll" @click="selectSound(option.id, $event)">
            <span class="video-sound-glyph" aria-hidden="true"><i /><i /><i /></span>
            <span>{{ option.label }}</span>
          </button>
          <AppDropdownMenu
            v-if="isGeneratedRecipe(option) || isSavedRecipe(option)"
            :open="soundActionsId === option.id"
            class="video-sound-row-actions"
            align="end"
            @update:open="soundActionsId = $event ? option.id : null"
          >
            <template #trigger="{ triggerProps }">
              <button v-bind="triggerProps" class="panel-secondary-action panel-icon-action" type="button" :aria-label="`Actions for ${option.label}`">
                <MoreH :size="18" aria-hidden="true" />
              </button>
            </template>
            <template #default>
              <button v-if="isGeneratedRecipe(option)" role="menuitem" type="button" @click="saveSound(option)">Save</button>
              <button role="menuitem" type="button" @click="deleteSound(option)">Delete</button>
            </template>
          </AppDropdownMenu>
        </div>
      </div>
      <button class="video-reset video-generate-sound" type="button" @click="generateSound">
        {{ generatedSounds.length ? 'Generate next' : 'Generate sound' }}
      </button>
    </fieldset>
    <fieldset v-if="enabled" class="video-sound-character">
      <legend>First accent</legend>
      <div class="video-choice-row" role="group" aria-label="First-frame accent">
        <button type="button" :aria-pressed="firstAccentEnabled" @click="firstAccentEnabled = true">On</button>
        <button type="button" :aria-pressed="!firstAccentEnabled" @click="firstAccentEnabled = false">Off</button>
      </div>
    </fieldset>
    <fieldset v-if="enabled" class="video-sound-character">
      <legend>Final accent</legend>
      <div class="video-choice-row" role="group" aria-label="Final accent">
        <button type="button" :aria-pressed="finalAccentEnabled" @click="finalAccentEnabled = true">On</button>
        <button type="button" :aria-pressed="!finalAccentEnabled" @click="finalAccentEnabled = false">Off</button>
      </div>
    </fieldset>
    <fieldset v-if="enabled" class="video-sound-character">
      <legend>Kick rhythm</legend>
      <AppDropdownMenu v-model:open="kickPatternOpen" class="video-kick-pattern">
        <template #trigger="{ triggerProps }">
          <button v-bind="triggerProps" class="panel-field panel-dropdown-trigger" type="button" :aria-label="`Kick rhythm: ${kickPatternLabel}`">
            <span>{{ kickPatternLabel }}</span>
            <span class="filter-dropdown-chevron" aria-hidden="true" />
          </button>
        </template>
        <template #default="{ close }">
          <button v-for="option in kickPatternOptions" :key="option.value" role="menuitemradio" type="button" :aria-checked="kickPattern === option.value" @click="auditionKickPattern(option.value); close(true)">
            {{ option.label }}
          </button>
        </template>
      </AppDropdownMenu>
    </fieldset>
    <fieldset v-if="enabled" class="video-sound-character">
      <legend>Mouse-wheel rhythm</legend>
      <div class="video-choice-row" role="group" aria-label="Transition beat count">
        <button v-for="option in transitionBeatOptions" :key="option.value" type="button" :aria-pressed="transitionBeats === option.value" @click="transitionBeats = option.value">
          {{ option.label }}
        </button>
      </div>
    </fieldset>
    <label v-if="enabled">
      <span>Volume <output>{{ volume }}%</output></span>
      <VideoRangeInput min="0" max="100" :value="volume" @input="volume = Number(($event.target as HTMLInputElement).value)" />
    </label>
    <p v-if="enabled">Synced to {{ cycleLabel }} video {{ cycleLabel === '1' ? 'cycle' : 'cycles' }} · included in export.</p>
  </fieldset>
</template>

<style scoped>
.video-procedural-audio {
  display: grid;
  gap: var(--video-inspector-section-gap);
}

.video-sound-character {
  color: var(--video-text-secondary);
  font-size: var(--video-type-body);
}

.video-kick-pattern {
  margin-top: var(--video-inspector-control-gap);
}

.video-sound-options {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--filter-option-gap);
  max-height: calc(var(--filter-action-height) * 3.5 + var(--filter-option-gap) * 3 + 8px);
  margin-top: var(--video-inspector-control-gap);
  padding: 4px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-block: contain;
  scrollbar-color: color-mix(in srgb, var(--filter-overlay-panel-color) 35%, transparent) transparent;
  scrollbar-width: thin;
  border-radius: calc(var(--radius) * 1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}

.video-sound-options::-webkit-scrollbar {
  width: 4px;
}

.video-sound-options::-webkit-scrollbar-track {
  background: transparent;
}

.video-sound-options::-webkit-scrollbar-thumb {
  border-radius: var(--filter-pill-radius);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 35%, transparent);
}

.video-generate-sound {
  margin-top: var(--video-inspector-control-gap);
}

.video-sound-option {
  min-width: 0;
  min-height: var(--filter-action-height);
  display: flex;
  align-items: center;
  border: 0;
  border-radius: var(--filter-pill-radius);
  color: var(--video-text-muted);
  background: transparent;
}

.video-sound-option.is-selected {
  color: var(--filter-overlay-panel-color);
}

.video-sound-option:is(:active, .is-selected) {
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.video-sound-option-select {
  min-width: 0;
  min-height: var(--filter-action-height);
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--filter-option-gap);
  padding: 0 var(--filter-option-padding);
  overflow: hidden;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: start;
}

.video-sound-option-select > span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-sound-option-select:is(:hover, :focus-visible) {
  color: var(--filter-overlay-panel-color);
}

.video-sound-row-actions {
  flex: 0 0 auto;
}

.video-sound-glyph {
  height: var(--filter-option-font-size);
  display: inline-flex;
  align-items: center;
  gap: calc(var(--filter-option-gap) / 4);
}

.video-sound-glyph i {
  width: 2px;
  height: 35%;
  border-radius: 999px;
  background: currentColor;
}

.video-sound-glyph i:nth-child(2) { height: 100%; }
.video-sound-glyph i:nth-child(3) { height: 62%; }

.video-procedural-audio p {
  margin: 0;
  padding-inline: calc(var(--filter-option-padding) / 2);
  color: var(--video-text-muted);
  font-size: var(--video-type-caption);
  line-height: 1.3;
}
</style>
