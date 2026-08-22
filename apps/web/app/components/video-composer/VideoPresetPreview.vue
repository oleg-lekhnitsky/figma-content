<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { AssetMasonryItem } from '~/types/asset-masonry'
import type { VideoTemplate } from '~/types/video-composer'
import VideoLivePresetPreview from '~/components/video-composer/VideoLivePresetPreview.vue'
import VideoPresetFrame from '~/components/video-composer/VideoPresetFrame.vue'

const props = withDefaults(defineProps<{ template: VideoTemplate; assets: AssetMasonryItem[]; previewing?: boolean; autoPreview?: boolean }>(), { autoPreview: true })
const emit = defineEmits<{ visibilityChange: [templateId: string, visible: boolean] }>()
const previewStyle = computed<CSSProperties>(() => ({ '--preview-duration': `${Math.max(1.2, Math.min(4, props.template.preset?.secondsPerSlide || 2))}s`, '--preview-tilt': `${(props.template.preset?.tilt || props.template.preset?.rotationZ || 0) * .35}deg`, '--preview-spin': `${props.template.preset?.spin || 0}deg` } as CSSProperties))
const previewClasses = computed(() => [`is-${props.template.collection}`, `is-${props.template.preset?.direction || 'up'}`, `is-${props.template.preset?.scaleStyle || 'bloom'}`, `grow-${props.template.preset?.growFrom || 'center'}`, `effect-${props.template.preset?.flickerEffect || 'off'}`, `drift-${props.template.preset?.driftDirection || 'up'}`])
const frameUrl = ref('')
const liveReady = ref(false)
const renderGeneratedFrame = ref(false)
const renderLightweightPreview = ref(false)
const previewRoot = ref<HTMLElement>()
const isVisible = ref(false)
const placeholderShades = ['d8d8d8', 'b8b8b8', 'eeeeee', '929292', 'c8c8c8', 'a4a4a4']
const placeholderAssets: AssetMasonryItem[] = placeholderShades.map((shade, index) => ({
  id: `preset-placeholder-${index}`,
  title: ' ',
  previewUrl: `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect width="300" height="400" fill="%23${shade}"/%3E%3C/svg%3E`,
  mime_type: 'image/svg+xml',
  width: 300,
  height: 400
}))
const previewAssets = computed(() => placeholderAssets)
const isLiveActive = computed(() => Boolean(props.previewing) || (props.autoPreview && renderLightweightPreview.value && isVisible.value))
watch(() => props.previewing, value => { if (!value) liveReady.value = false })
watch(isLiveActive, value => { if (!value) liveReady.value = false })
let visibilityObserver: IntersectionObserver | undefined
onMounted(() => {
  const lightweight = window.matchMedia('(max-width: 640px), (pointer: coarse)').matches
  renderLightweightPreview.value = lightweight
  renderGeneratedFrame.value = !lightweight
  if (lightweight && previewRoot.value) {
    visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible.value = Boolean(entry?.isIntersecting)
      emit('visibilityChange', props.template.id, isVisible.value)
      if (entry?.isIntersecting && !props.autoPreview) renderGeneratedFrame.value = true
    }, { rootMargin: '80px 0px', threshold: .01 })
    visibilityObserver.observe(previewRoot.value)
  }
})
onBeforeUnmount(() => {
  visibilityObserver?.disconnect()
  if (isVisible.value) emit('visibilityChange', props.template.id, false)
})
</script>

<template>
  <span ref="previewRoot" class="video-template-thumb video-preset-preview" :class="[previewClasses, { 'is-live-active': isLiveActive, 'is-live-ready': liveReady }]"
    :style="previewStyle" aria-hidden="true"><img v-if="frameUrl" class="video-preset-first-frame" :src="frameUrl"
      alt=""><template v-else>
      <VideoPresetFrame v-if="renderGeneratedFrame && previewAssets.length" :template="template" :assets="previewAssets" @ready="frameUrl = $event" />
    </template>
    <VideoLivePresetPreview v-if="isLiveActive && previewAssets.length" class="video-live-layer"
      :class="{ 'is-ready': liveReady }" :template="template" :assets="previewAssets"
      :transparent-background="renderLightweightPreview" @ready="liveReady = true" />
  </span>
</template>

<style scoped>
.video-preset-preview {
  width: 100%;
  min-height: 72px;
  aspect-ratio: 3/4;
  border-radius: calc(var(--radius)/3);
  pointer-events: none
}

.video-preset-first-frame {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover
}

.is-live-ready .video-preset-first-frame {
  visibility: hidden
}

.video-live-layer {
  z-index: 2;
  opacity: 0
}

.video-live-layer.is-ready {
  opacity: 1
}

.is-live-active .video-preset-preview-track,
.is-live-active .video-preset-preview-track img,
.is-live-active .video-preset-preview-track i {
  animation: none !important
}

.is-flicker .video-preset-preview-track i:first-child {
  opacity: 1
}

.video-preset-preview {
  position: relative;
  display: block;
  overflow: hidden;
  background: #090909;
  perspective: 180px;
  isolation: isolate
}

.video-preset-preview-track,
.video-preset-preview i {
  position: absolute;
  display: block;
  will-change: transform, opacity
}

.video-preset-preview i {
  box-shadow: inset 0 0 0 1px oklch(1 0 0/.1);
  background-size: cover !important
}

.is-carousel .video-preset-preview-track {
  inset: -60% 15%;
  display: grid;
  gap: 7%;
  grid-template-rows: repeat(4, 1fr);
  transform: rotate(var(--preview-tilt))
}

.is-carousel.is-left .video-preset-preview-track,
.is-carousel.is-right .video-preset-preview-track {
  inset: 15% -60%;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: 1fr
}

.is-carousel .video-preset-preview-track i {
  position: relative;
  border-radius: 3px
}

.is-carousel-3d .video-preset-preview-track {
  inset: 0;
  transform-style: preserve-3d
}

.is-carousel-3d .video-preset-preview-track i {
  inset: 22% 18%;
  border-radius: 3px;
  transform: rotateY(calc(var(--preview-index)*72deg)) translateZ(42px)
}

.is-scale .video-preset-preview-track,
.is-flicker .video-preset-preview-track {
  inset: 0
}

.is-scale .video-preset-preview-track i,
.is-flicker .video-preset-preview-track i {
  inset: 15%;
  border-radius: 3px;
  opacity: calc(1 - var(--preview-index)*.18)
}

.is-scale .video-preset-preview-track i {
  transform: scale(calc(.4 + var(--preview-index)*.14))
}

.is-scale.is-recede .video-preset-preview-track i {
  transform: scale(calc(1 - var(--preview-index)*.14))
}

.is-flicker .video-preset-preview-track i {
  opacity: 0
}

@media (prefers-reduced-motion:no-preference) {
  :global(.video-template-preset:hover) .is-carousel .video-preset-preview-track,
  :global(.video-template-preset:focus-visible) .is-carousel .video-preset-preview-track {
    animation: preview-carousel var(--preview-duration) linear infinite
  }

  :global(.video-template-preset:hover) .is-carousel.is-down .video-preset-preview-track,
  :global(.video-template-preset:hover) .is-carousel.is-right .video-preset-preview-track,
  :global(.video-template-preset:focus-visible) .is-carousel.is-down .video-preset-preview-track,
  :global(.video-template-preset:focus-visible) .is-carousel.is-right .video-preset-preview-track {
    animation-direction: reverse
  }

  :global(.video-template-preset:hover) .is-carousel-3d .video-preset-preview-track,
  :global(.video-template-preset:focus-visible) .is-carousel-3d .video-preset-preview-track {
    animation: preview-orbit var(--preview-duration) linear infinite
  }

  :global(.video-template-preset:hover) .is-scale .video-preset-preview-track i,
  :global(.video-template-preset:focus-visible) .is-scale .video-preset-preview-track i {
    animation: preview-scale var(--preview-duration) cubic-bezier(.33, 0, 0, 1) infinite;
    animation-delay: calc(var(--preview-index)*-180ms)
  }

  :global(.video-template-preset:hover) .is-scale.is-recede .video-preset-preview-track i,
  :global(.video-template-preset:focus-visible) .is-scale.is-recede .video-preset-preview-track i {
    animation-direction: reverse
  }

  :global(.video-template-preset:hover) .is-flicker .video-preset-preview-track i,
  :global(.video-template-preset:focus-visible) .is-flicker .video-preset-preview-track i {
    animation: preview-flicker var(--preview-duration) steps(1, end) infinite;
    animation-delay: calc(var(--preview-index)*-500ms)
  }

  :global(.video-template-preset:hover) .is-flicker.effect-scale .video-preset-preview-track,
  :global(.video-template-preset:focus-visible) .is-flicker.effect-scale .video-preset-preview-track {
    animation: preview-flicker-scale 900ms ease-in-out infinite alternate
  }

  :global(.video-template-preset:hover) .is-flicker.effect-drift .video-preset-preview-track,
  :global(.video-template-preset:focus-visible) .is-flicker.effect-drift .video-preset-preview-track {
    animation: preview-flicker-drift 900ms ease-in-out infinite alternate
  }
}

.video-preset-preview-track img {
  position: absolute;
  display: block;
  max-width: none;
  object-fit: contain;
  box-shadow: inset 0 0 0 1px oklch(1 0 0/.1);
  will-change: transform, opacity
}

.is-carousel .video-preset-preview-track img {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 3px
}

.is-carousel-3d .video-preset-preview-track img {
  inset: 18% 15%;
  width: 70%;
  height: 64%;
  border-radius: 3px;
  opacity: .72;
  transform: translateX(calc((var(--preview-index) - 1.5)*18%)) scale(calc(.72 + var(--preview-index)*.06))
}

.is-scale .video-preset-preview-track img,
.is-flicker .video-preset-preview-track img {
  inset: 15%;
  width: 70%;
  height: 70%;
  border-radius: 3px
}

.is-scale .video-preset-preview-track img {
  opacity: calc(1 - var(--preview-index)*.18);
  transform: scale(calc(.4 + var(--preview-index)*.14))
}

.is-scale.is-recede .video-preset-preview-track img {
  transform: scale(calc(1 - var(--preview-index)*.14))
}

.is-flicker .video-preset-preview-track img {
  opacity: 0
}

.is-flicker .video-preset-preview-track img:first-child {
  opacity: 1
}

@media (prefers-reduced-motion:no-preference) {

  :global(.video-template-preset:hover) .is-carousel-3d .video-preset-preview-track,
  :global(.video-template-preset:focus-visible) .is-carousel-3d .video-preset-preview-track {
    animation: none
  }

  :global(.video-template-preset:hover) .is-carousel-3d .video-preset-preview-track img,
  :global(.video-template-preset:focus-visible) .is-carousel-3d .video-preset-preview-track img {
    animation: preview-depth var(--preview-duration) ease-in-out infinite;
    animation-delay: calc(var(--preview-index)*-420ms)
  }

  :global(.video-template-preset:hover) .is-scale .video-preset-preview-track img,
  :global(.video-template-preset:focus-visible) .is-scale .video-preset-preview-track img {
    animation: preview-scale var(--preview-duration) cubic-bezier(.33, 0, 0, 1) infinite;
    animation-delay: calc(var(--preview-index)*-180ms)
  }

  :global(.video-template-preset:hover) .is-scale.is-recede .video-preset-preview-track img,
  :global(.video-template-preset:focus-visible) .is-scale.is-recede .video-preset-preview-track img {
    animation-direction: reverse
  }

  :global(.video-template-preset:hover) .is-flicker .video-preset-preview-track img,
  :global(.video-template-preset:focus-visible) .is-flicker .video-preset-preview-track img {
    animation: preview-flicker var(--preview-duration) steps(1, end) infinite;
    animation-delay: calc(var(--preview-index)*-500ms)
  }

  :global(.video-template-preset:hover) .is-flicker.effect-scale .video-preset-preview-track,
  :global(.video-template-preset:focus-visible) .is-flicker.effect-scale .video-preset-preview-track {
    animation: preview-flicker-scale 900ms ease-in-out infinite alternate
  }

  :global(.video-template-preset:hover) .is-flicker.effect-drift .video-preset-preview-track,
  :global(.video-template-preset:focus-visible) .is-flicker.effect-drift .video-preset-preview-track {
    animation: preview-flicker-drift 900ms ease-in-out infinite alternate
  }
}

@media (prefers-reduced-motion:no-preference) {
  .is-previewing.is-carousel .video-preset-preview-track {
    animation: preview-carousel var(--preview-duration) linear infinite
  }

  .is-previewing.is-carousel.is-left .video-preset-preview-track,
  .is-previewing.is-carousel.is-right .video-preset-preview-track {
    animation-name: preview-carousel-horizontal !important
  }

  .is-previewing.is-carousel-3d .video-preset-preview-track {
    animation: preview-3d-pan var(--preview-duration) ease-in-out infinite
  }

  .is-previewing.is-scale .video-preset-preview-track img {
    animation: preview-scale var(--preview-duration) cubic-bezier(.33, 0, 0, 1) infinite;
    animation-delay: calc(var(--preview-index)*-180ms)
  }

  .is-previewing.is-scale.is-recede .video-preset-preview-track img {
    animation-direction: reverse
  }

  .is-previewing.is-flicker .video-preset-preview-track img {
    animation: preview-flicker var(--preview-duration) steps(1, end) infinite;
    animation-delay: calc(var(--preview-index)*-500ms)
  }

  .is-previewing.is-flicker.effect-scale .video-preset-preview-track {
    animation: preview-flicker-scale 900ms ease-in-out infinite alternate
  }

  .is-previewing.is-flicker.effect-drift .video-preset-preview-track {
    animation: preview-flicker-drift 900ms ease-in-out infinite alternate
  }
}

/* @keyframes preview-carousel {
  to {
    transform: translateY(25%) rotate(var(--preview-tilt))
  }
} */

.is-carousel.is-left .video-preset-preview-track,
.is-carousel.is-right .video-preset-preview-track {
  animation-name: preview-carousel-horizontal !important
}

@keyframes preview-carousel-horizontal {
  to {
    transform: translateX(25%) rotate(var(--preview-tilt))
  }
}

@keyframes preview-orbit {
  to {
    transform: rotateY(360deg)
  }
}

@keyframes preview-3d-pan {

  0%,
  100% {
    transform: translateX(-4%)
  }

  50% {
    transform: translateX(4%)
  }
}

@keyframes preview-depth {

  0%,
  100% {
    transform: translateX(-22%);
    opacity: .55
  }

  50% {
    transform: translateX(22%);
    opacity: 1
  }
}

@keyframes preview-scale {
  0% {
    transform: scale(.12);
    opacity: 0
  }

  45%,
  100% {
    transform: scale(1);
    opacity: 1
  }
}

@keyframes preview-flicker {

  0%,
  24% {
    opacity: 1
  }

  25%,
  100% {
    opacity: 0
  }
}

@keyframes preview-flicker-scale {
  from {
    transform: scale(.82)
  }

  to {
    transform: scale(1.12)
  }
}

@keyframes preview-flicker-drift {
  from {
    transform: translateY(0%)
  }

  to {
    transform: translateY(-0%)
  }
}

.is-scale .video-preset-preview-track :is(img, i) {
  transform-origin: center
}

.is-scale.grow-top .video-preset-preview-track :is(img, i) {
  transform-origin: center top
}

.is-scale.grow-bottom .video-preset-preview-track :is(img, i) {
  transform-origin: center bottom
}

.is-scale.grow-left .video-preset-preview-track :is(img, i) {
  transform-origin: left center
}

.is-scale.grow-right .video-preset-preview-track :is(img, i) {
  transform-origin: right center
}

.is-scale .video-preset-preview-track :is(img, i) {
  transform: rotate(var(--preview-spin)) scale(calc(.4 + var(--preview-index)*.14))
}

.is-scale.is-recede .video-preset-preview-track :is(img, i) {
  transform: rotate(var(--preview-spin)) scale(calc(1 - var(--preview-index)*.14))
}

@keyframes preview-scale {
  0% {
    transform: rotate(var(--preview-spin)) scale(.12);
    opacity: 0
  }

  45%,
  100% {
    transform: rotate(0deg) scale(1);
    opacity: 1
  }
}
</style>
