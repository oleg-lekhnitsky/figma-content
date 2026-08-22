<script setup lang="ts">
import { Pause, Play } from 'reicon-vue'

const props = defineProps<{ safeArea?: boolean; playing?: boolean }>()
const emit = defineEmits<{ ready: [canvas: HTMLCanvasElement]; toggle: [] }>()
const stage = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const previewSize = ref({ width: 0, height: 0 })
const controlsVisible = ref(true)
let controlsTimer: ReturnType<typeof setTimeout> | undefined

const showControls = () => {
  clearTimeout(controlsTimer)
  controlsVisible.value = true
  if (props.playing) controlsTimer = setTimeout(() => { controlsVisible.value = false }, 900)
}
watch(() => props.playing, playing => {
  clearTimeout(controlsTimer)
  controlsVisible.value = true
  if (playing) controlsTimer = setTimeout(() => { controlsVisible.value = false }, 900)
}, { immediate: true })

const fitPreview = () => {
  const host = stage.value
  const target = canvas.value
  if (!host || !target) return
  const styles=getComputedStyle(host)
  const horizontalPadding=parseFloat(styles.paddingLeft)+parseFloat(styles.paddingRight)
  const verticalPadding=parseFloat(styles.paddingTop)+parseFloat(styles.paddingBottom)
  const availableWidth = Math.max(0,host.clientWidth-horizontalPadding)
  const availableHeight = Math.max(0,host.clientHeight-verticalPadding)
  const aspectRatio = target.width / Math.max(1, target.height)
  const width = Math.min(availableWidth, availableHeight * aspectRatio)
  previewSize.value = { width, height: width / aspectRatio }
}

let resizeObserver: ResizeObserver | undefined
let canvasObserver: MutationObserver | undefined
onMounted(() => {
  if (!canvas.value || !stage.value) return
  emit('ready', canvas.value)
  resizeObserver = new ResizeObserver(fitPreview)
  resizeObserver.observe(stage.value)
  canvasObserver = new MutationObserver(fitPreview)
  canvasObserver.observe(canvas.value, { attributes: true, attributeFilter: ['width', 'height'] })
  nextTick(fitPreview)
})
onBeforeUnmount(() => {
  clearTimeout(controlsTimer)
  resizeObserver?.disconnect()
  canvasObserver?.disconnect()
})
</script>

<template><div ref="stage" class="video-stage"><div class="video-canvas-wrap" :style="{ width: `${previewSize.width}px`, height: `${previewSize.height}px` }"><canvas ref="canvas" aria-label="Video preview" /><div v-if="safeArea" class="video-safe-area" aria-hidden="true" /></div><div class="video-stage-controls" :style="{ width: `${previewSize.width}px`, height: `${previewSize.height}px` }" @click="showControls"><button class="video-stage-play" :class="{ 'is-hidden': playing && !controlsVisible }" type="button" :aria-label="playing ? 'Pause video' : 'Play video'" :aria-pressed="playing" @focus="showControls" @click.stop="emit('toggle')"><span class="video-stage-play-icon video-stage-play-icon--play" :class="{ active: !playing }" aria-hidden="true"><Play :size="28" weight="Filled" /></span><span class="video-stage-play-icon video-stage-play-icon--pause" :class="{ active: playing }" aria-hidden="true"><Pause :size="28" weight="Filled" /></span></button></div></div></template>
