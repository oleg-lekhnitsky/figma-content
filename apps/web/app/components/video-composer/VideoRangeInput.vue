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
</script>

<template>
  <input
    class="video-range-input" type="range" :min="min" :max="max" :step="step" :value="value"
    :style="style">
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
    touch-action: none;
    -webkit-user-select: none;
    user-select: none
  }

  .video-range-input::-webkit-slider-thumb {
    width: 28px;
    height: 28px;
    margin-top: 8px;
    border-radius: 14px;
    background: linear-gradient(to right, transparent 12px, var(--video-range-handle) 12px 16px, transparent 16px);
    opacity: 1
  }

  .video-range-input::-moz-range-thumb {
    width: 28px;
    height: 28px;
    border-radius: 14px;
    background: linear-gradient(to right, transparent 12px, var(--video-range-handle) 12px 16px, transparent 16px);
    opacity: 1
  }
}
</style>
