<script setup lang="ts">
import type { SoundPreset, SoundWave } from '~/types/video-sound'
import { soundLayers, soundParameters, updateSoundFilter, updateSoundParameter, updateSoundWave, type SoundParameter } from '~/utils/video-sound-parameters'
import AppDropdownMenu from '~/components/AppDropdownMenu.vue'
import VideoRangeInput from '~/components/video-composer/VideoRangeInput.vue'

const props = defineProps<{ sound: SoundPreset, modified: boolean, canSave: boolean }>()
const emit = defineEmits<{ update: [sound: SoundPreset], reset: [], save: [], preview: [] }>()
const layerIndex = ref(0)
const openMenu = ref<'layer' | 'wave' | 'filter' | null>(null)
const layers = computed(() => props.sound.kind === 'recipe' ? soundLayers(props.sound) : [])
const layer = computed(() => layers.value[layerIndex.value])
const fields = computed(() => soundParameters(props.sound, layerIndex.value))
const wave = computed(() => props.sound.kind === 'generated' ? props.sound.wave : layer.value?.source.type)
const waveOptions: ReadonlyArray<{ value: SoundWave | 'noise', label: string }> = [
  { value: 'sine', label: 'Sine' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'square', label: 'Square' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'noise', label: 'White noise' },
]
const availableWaves = computed(() => props.sound.kind === 'generated' ? waveOptions.filter(option => option.value !== 'noise') : waveOptions)
const filterOptions: ReadonlyArray<{ value: BiquadFilterType | 'off', label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'lowpass', label: 'Low-pass' },
  { value: 'highpass', label: 'High-pass' },
  { value: 'bandpass', label: 'Band-pass' },
  { value: 'notch', label: 'Notch' },
]
const filter = computed(() => layer.value?.filter?.type ?? 'off')
const waveLabel = computed(() => waveOptions.find(option => option.value === wave.value)?.label)
const filterLabel = computed(() => filterOptions.find(option => option.value === filter.value)?.label ?? filter.value)
const formatValue = (field: SoundParameter) => `${Number(field.value.toFixed(2))}${['Hz', 'ms'].includes(field.unit) ? ' ' : ''}${field.unit}`
const changeWave = (value: SoundWave | 'noise') => {
  emit('update', updateSoundWave(props.sound, layerIndex.value, value))
  emit('preview')
}
const changeFilter = (value: BiquadFilterType | 'off') => {
  emit('update', updateSoundFilter(props.sound, layerIndex.value, value))
  emit('preview')
}
watch(() => props.sound.id, () => {
  layerIndex.value = 0
  openMenu.value = null
})
</script>

<template>
  <details class="video-sound-advanced" @toggle="!($event.target as HTMLDetailsElement).open && (openMenu = null)">
    <summary class="panel-field panel-dropdown-trigger">
      <span>Advanced</span>
      <span class="filter-dropdown-chevron" aria-hidden="true" />
    </summary>
    <div class="video-sound-advanced-controls">
      <AppDropdownMenu v-if="layers.length > 1" :open="openMenu === 'layer'" @update:open="openMenu = $event ? 'layer' : null">
        <template #trigger="{ triggerProps }">
          <button v-bind="triggerProps" class="panel-field panel-dropdown-trigger" type="button" :aria-label="`Sound layer: ${layerIndex + 1}`">
            <span>Layer {{ layerIndex + 1 }}</span><span class="filter-dropdown-chevron" aria-hidden="true" />
          </button>
        </template>
        <template #default="{ close }">
          <button v-for="(_, index) in layers" :key="index" role="menuitemradio" type="button" :aria-checked="layerIndex === index" @click="layerIndex = index; close(true)">Layer {{ index + 1 }}</button>
        </template>
      </AppDropdownMenu>
      <fieldset class="video-sound-advanced-choice">
        <legend>Waveform</legend>
        <AppDropdownMenu :open="openMenu === 'wave'" @update:open="openMenu = $event ? 'wave' : null">
          <template #trigger="{ triggerProps }">
            <button v-bind="triggerProps" class="panel-field panel-dropdown-trigger" type="button" :aria-label="`Waveform: ${waveLabel}`">
              <span>{{ waveLabel }}</span><span class="filter-dropdown-chevron" aria-hidden="true" />
            </button>
          </template>
          <template #default="{ close }">
            <button v-for="option in availableWaves" :key="option.value" role="menuitemradio" type="button" :aria-checked="wave === option.value" @click="changeWave(option.value); close(true)">{{ option.label }}</button>
          </template>
        </AppDropdownMenu>
      </fieldset>
      <fieldset v-if="sound.kind === 'recipe'" class="video-sound-advanced-choice">
        <legend>Filter</legend>
        <AppDropdownMenu :open="openMenu === 'filter'" @update:open="openMenu = $event ? 'filter' : null">
          <template #trigger="{ triggerProps }">
            <button v-bind="triggerProps" class="panel-field panel-dropdown-trigger" type="button" :aria-label="`Filter: ${filterLabel}`">
              <span>{{ filterLabel }}</span><span class="filter-dropdown-chevron" aria-hidden="true" />
            </button>
          </template>
          <template #default="{ close }">
            <button v-for="option in filterOptions" :key="option.value" role="menuitemradio" type="button" :aria-checked="filter === option.value" @click="changeFilter(option.value); close(true)">{{ option.label }}</button>
          </template>
        </AppDropdownMenu>
      </fieldset>
      <label v-for="field in fields" :key="`${layerIndex}-${field.key}`">
        <span>{{ field.label }} <output>{{ formatValue(field) }}</output></span>
        <VideoRangeInput :min="field.min" :max="field.max" :step="field.step" :snap-step="field.step" :value="field.value" @input="emit('update', updateSoundParameter(sound, layerIndex, field.key, Number(($event.target as HTMLInputElement).value)))" @change="emit('preview')" />
      </label>
      <button class="panel-secondary-action" type="button" @click="emit('preview')">Preview sound</button>
      <div class="video-sound-advanced-actions">
        <button class="panel-secondary-action" type="button" :disabled="!modified" @click="emit('reset')">Reset</button>
        <button class="panel-primary-action" type="button" :disabled="!canSave" @click="emit('save')">Save preset</button>
      </div>
    </div>
  </details>
</template>

<style scoped>
.video-sound-advanced { margin-top: var(--video-inspector-control-gap); }
.video-sound-advanced > summary { list-style: none; cursor: pointer; }
.video-sound-advanced > summary::-webkit-details-marker { display: none; }
.video-sound-advanced[open] > summary .filter-dropdown-chevron { rotate: 225deg; }
.video-sound-advanced-controls {
  display: grid;
  gap: var(--video-inspector-section-gap);
  padding-top: var(--video-inspector-section-gap);
}
.video-sound-advanced-choice > .app-popover { margin-top: var(--video-inspector-control-gap); }
.video-sound-advanced-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--filter-action-gap);
}
</style>
