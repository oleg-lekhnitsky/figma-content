<script setup lang="ts">
import type { CSSProperties } from 'vue'

const props = withDefaults(defineProps<{
  value?: number
  min?: number | string
  max?: number | string
  step?: number | string
}>(), { value: 0, min: 0, max: 100, step: 1 })

const minimum = computed(() => Number(props.min))
const maximum = computed(() => Number(props.max))
const position = computed(() => Math.max(0, Math.min(100, (props.value - minimum.value) / Math.max(.000001, maximum.value - minimum.value) * 100)))
const zero = computed(() => Math.max(0, Math.min(100, (0 - minimum.value) / Math.max(.000001, maximum.value - minimum.value) * 100)))
const style = computed<CSSProperties>(() => ({
  '--video-range-start': `${Math.min(position.value, zero.value)}%`,
  '--video-range-end': `${Math.max(position.value, zero.value)}%`
} as CSSProperties))

let touchPointerId: number | undefined
let touchStartX = 0
let touchStartY = 0
let touchAxis: 'pending' | 'horizontal' | 'vertical' = 'pending'

const setTouchValue = (input: HTMLInputElement, clientX: number) => {
  if (input.disabled) return
  const bounds = input.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width)))
  const rawValue = minimum.value + ratio * (maximum.value - minimum.value)
  const numericStep = props.step === 'any' ? 0 : Number(props.step)
  const value = numericStep > 0
    ? minimum.value + Math.round((rawValue - minimum.value) / numericStep) * numericStep
    : rawValue
  input.value = String(Math.max(minimum.value, Math.min(maximum.value, value)))
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const startTouch = (event: PointerEvent) => {
  if (event.pointerType !== 'touch') return
  touchPointerId = event.pointerId
  touchStartX = event.clientX
  touchStartY = event.clientY
  touchAxis = 'pending'
}

const moveTouch = (event: PointerEvent) => {
  if (event.pointerId !== touchPointerId) return
  const deltaX = event.clientX - touchStartX
  const deltaY = event.clientY - touchStartY
  if (touchAxis === 'pending' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 6) {
    touchAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
    if (touchAxis === 'horizontal') (event.currentTarget as HTMLInputElement).setPointerCapture(event.pointerId)
  }
  if (touchAxis !== 'horizontal') return
  event.preventDefault()
  setTouchValue(event.currentTarget as HTMLInputElement, event.clientX)
}

const finishTouch = (event: PointerEvent) => {
  if (event.pointerId !== touchPointerId) return
  if (touchAxis !== 'vertical') setTouchValue(event.currentTarget as HTMLInputElement, event.clientX)
  touchPointerId = undefined
  touchAxis = 'pending'
}

const cancelTouch = (event: PointerEvent) => {
  if (event.pointerId === touchPointerId) touchPointerId = undefined
}
</script>

<template>
  <input
    class="video-range-input" type="range" :min="min" :max="max" :step="step" :value="value"
    :style="style" @pointerdown="startTouch" @pointermove="moveTouch" @pointerup="finishTouch"
    @pointercancel="cancelTouch">
</template>

<style scoped>
.video-range-input {
  --video-range-track: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  --video-range-fill: color-mix(in srgb, var(--filter-overlay-panel-color) 14%, transparent);
  --video-range-fill-hover: color-mix(in srgb, var(--filter-overlay-panel-color) 20%, transparent);
  --video-range-handle: color-mix(in srgb, var(--filter-overlay-panel-color) 32%, transparent);
  --video-range-handle-hover: color-mix(in srgb, var(--filter-overlay-panel-color) 46%, transparent);
  display: block;
  width: 100%;
  height: 34px;
  margin: 0;
  border: 0;
  border-radius: calc(var(--radius));
  appearance: none;
  -webkit-appearance: none;
  cursor: ew-resize;
  outline: 0;
  background: linear-gradient(to right, var(--video-range-track) 0 var(--video-range-start), var(--video-range-fill) var(--video-range-start) var(--video-range-end), var(--video-range-track) var(--video-range-end) 100%);
  transition-property: background-color;
  transition-duration: .12s
}

.video-range-input:hover {
  background: linear-gradient(to right, var(--video-range-track) 0 var(--video-range-start), var(--video-range-fill-hover) var(--video-range-start) var(--video-range-end), var(--video-range-track) var(--video-range-end) 100%)
}

.video-range-input::-webkit-slider-runnable-track {
  height: 100%;
  background: transparent
}

.video-range-input::-moz-range-track {
  height: 100%;
  background: transparent
}

.video-range-input::-webkit-slider-thumb {
  width: 2px;
  height: 16px;
  margin-top: 9px;
  border: 0;
  border-radius: 1px;
  appearance: none;
  -webkit-appearance: none;
  background: var(--video-range-handle);
  opacity: 0;
  transition-property: background-color, opacity;
  transition-duration: .12s
}

.video-range-input::-moz-range-thumb {
  width: 2px;
  height: 16px;
  border: 0;
  border-radius: 1px;
  background: var(--video-range-handle);
  opacity: 0;
  transition-property: background-color, opacity;
  transition-duration: .12s
}

.video-range-input:hover::-webkit-slider-thumb {
  background: var(--video-range-handle-hover);
  opacity: 1
}

.video-range-input:hover::-moz-range-thumb {
  background: var(--video-range-handle-hover);
  opacity: 1
}

.video-range-input:focus-visible {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--filter-overlay-panel-color) 62%, transparent)
}

.video-range-input:disabled {
  cursor: not-allowed;
  opacity: .4
}

@media (hover: none), (pointer: coarse) {
  .video-range-input {
    height: 44px;
    touch-action: pan-y
  }

  .video-range-input::-webkit-slider-thumb {
    width: 4px;
    height: 24px;
    margin-top: 10px;
    border-radius: 2px;
    opacity: 1
  }

  .video-range-input::-moz-range-thumb {
    width: 4px;
    height: 24px;
    border-radius: 2px;
    opacity: 1
  }
}
</style>
