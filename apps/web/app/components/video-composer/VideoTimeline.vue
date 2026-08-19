<script setup lang="ts">
import { Pause, Play } from 'reicon-vue'

const props = defineProps<{ progress: number; duration: number; playing: boolean }>()
defineEmits<{ seek: [value: number]; toggle: [] }>()
const formatTime = (seconds: number) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${Math.floor(safe % 60).toString().padStart(2, '0')}`
}
const progressPercent = computed(() => `${props.duration ? Math.min(100, Math.max(0, props.progress / props.duration * 100)) : 0}%`)
const majorStep = computed(() => props.duration <= 16 ? 2 : props.duration <= 32 ? 4 : 10)
const ticks = computed(() => {
  const step = majorStep.value / 4
  const values: Array<{ value: number; major: boolean }> = []
  for (let value = 0; value <= props.duration + .001; value += step) {
    values.push({ value, major: Math.abs(value / majorStep.value - Math.round(value / majorStep.value)) < .001 })
  }
  return values
})
</script>

<template>
  <div class="video-timeline" :style="{ '--timeline-progress': progressPercent }">
    <button class="video-timeline-play" type="button" :aria-label="playing ? 'Pause video' : 'Play video'" @click="$emit('toggle')">
      <Pause v-if="playing" :size="22" weight="Filled" aria-hidden="true" />
      <Play v-else :size="22" weight="Filled" aria-hidden="true" />
    </button>
    <output class="video-timeline-time"><span>{{ formatTime(progress) }}</span><span> / {{ formatTime(duration) }}s</span></output>
    <div class="video-timeline-ruler">
      <div class="video-timeline-scale" aria-hidden="true">
        <span v-for="tick in ticks.filter(item => !item.major)" :key="`dot-${tick.value}`" class="video-timeline-dot" :style="{ left: `${duration ? tick.value / duration * 100 : 0}%` }" />
        <span v-for="tick in ticks.filter(item => item.major)" :key="`label-${tick.value}`" class="video-timeline-label" :style="{ left: `${duration ? tick.value / duration * 100 : 0}%`, transform: tick.value === 0 ? 'none' : tick.value / duration >= .995 ? 'translateX(-100%)' : 'translateX(-50%)' }">
          {{ tick.value }}s
        </span>
      </div>
      <div class="video-timeline-playhead" aria-hidden="true" />
      <input type="range" min="0" :max="duration" step="0.01" :value="progress" aria-label="Video position" @input="$emit('seek',Number(($event.target as HTMLInputElement).value))">
    </div>
    <div class="video-timeline-actions"><slot /></div>
  </div>
</template>
