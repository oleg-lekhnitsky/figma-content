<script setup lang="ts">
import { Pause, Play } from 'reicon-vue'

const props = defineProps<{ progress: number; duration: number; playing: boolean }>()
defineEmits<{ seek: [value: number]; toggle: [] }>()
const formatTime = (seconds: number) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  return Math.floor(safe).toString()
}
const progressPercent = computed(() => `${props.duration ? Math.min(100, Math.max(0, props.progress / props.duration * 100)) : 0}%`)
const ruler = ref<HTMLElement | null>(null)
const rulerWidth = ref(240)
let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  if (!ruler.value) return
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) rulerWidth.value = entry.contentRect.width
  })
  resizeObserver.observe(ruler.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

const majorStep = computed(() => {
  const labelWidth = Math.max(64, `${formatTime(props.duration)}s`.length * 16 + 16)
  const intervals = Math.max(1, Math.floor((rulerWidth.value - 12) / labelWidth))
  const target = Math.max(1, props.duration / intervals)
  const magnitude = 10 ** Math.floor(Math.log10(target))
  return ([1, 2, 5, 10].find(step => step * magnitude >= target) ?? 10) * magnitude
})
const ticks = computed(() => {
  const subdivisions = 6
  const step = majorStep.value / subdivisions
  const values: Array<{ value: number; major: boolean }> = []
  for (let index = 0; index * step <= props.duration; index++) {
    values.push({ value: index * step, major: index % subdivisions === 0 })
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
    <div ref="ruler" class="video-timeline-ruler">
      <div class="video-timeline-scale" aria-hidden="true">
        <span v-for="tick in ticks.filter(item => !item.major)" :key="`tick-${tick.value}`" class="video-timeline-tick" :style="{ left: `${duration ? tick.value / duration * 100 : 0}%` }" />
        <span v-for="tick in ticks.filter(item => item.major)" :key="`label-${tick.value}`" class="video-timeline-label" :style="{ left: `${duration ? tick.value / duration * 100 : 0}%`, transform: tick.value === 0 ? 'none' : tick.value / duration >= .995 ? 'translateX(-100%)' : 'translateX(-50%)' }">
          {{ tick.value }}s
        </span>
        <div class="video-timeline-playhead" />
      </div>
      <input type="range" min="0" :max="duration || 1" step="0.01" :value="progress" :disabled="duration <= 0" aria-label="Video position" :aria-valuetext="`${formatTime(progress)} of ${formatTime(duration)} seconds`" @input="$emit('seek',Number(($event.target as HTMLInputElement).value))">
    </div>
    <div class="video-timeline-actions"><slot /></div>
  </div>
</template>
