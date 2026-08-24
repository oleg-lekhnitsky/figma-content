<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  src: string
  fallbackSrcs?: string[]
  srcset?: string
  sizes?: string
  singleResolutionMedia?: string
  mimeType?: string | null
  width?: number
  height?: number
  alt?: string
  loading?: 'eager' | 'lazy'
  fetchpriority?: 'high' | 'low' | 'auto'
  autoplay?: boolean
}>(), { fallbackSrcs: () => [], srcset: undefined, sizes: undefined, singleResolutionMedia: undefined, mimeType: null, width: undefined, height: undefined, alt: '', loading: 'lazy', fetchpriority: 'auto', autoplay: true })
defineEmits<{ load: [] }>()
const video = ref<HTMLVideoElement>()
const sourceIndex = ref(0)
const sourceCandidates = computed(() => [...new Set([props.src, ...props.fallbackSrcs].filter(Boolean))])
const currentSrc = computed(() => sourceCandidates.value[sourceIndex.value] ?? props.src)
const currentSrcset = computed(() => sourceIndex.value === 0 ? props.srcset : undefined)
watch(sourceCandidates, () => { sourceIndex.value = 0 })
const useFallback = () => {
  if (sourceIndex.value >= sourceCandidates.value.length - 1) return
  sourceIndex.value += 1
}
watch(() => props.autoplay, shouldPlay => {
  if (!video.value) return
  if (shouldPlay) void video.value.play().catch(() => undefined)
  else video.value.pause()
})
</script>

<template>
  <video v-if="mimeType?.startsWith('video/')" ref="video" v-bind="$attrs" :src="currentSrc" :width="width" :height="height" :autoplay="autoplay" muted loop playsinline preload="metadata" :aria-label="alt || undefined" @loadeddata="$emit('load')" @error="useFallback" />
  <template v-else>
    <picture v-if="singleResolutionMedia" class="asset-media-picture">
      <source :media="singleResolutionMedia" :srcset="currentSrc">
      <img v-bind="$attrs" :src="currentSrc" :srcset="currentSrcset" :sizes="sizes" :width="width" :height="height" :alt="alt" :loading="loading" :fetchpriority="fetchpriority" decoding="async" @load="$emit('load')" @error="useFallback">
    </picture>
    <img v-else v-bind="$attrs" :src="currentSrc" :srcset="currentSrcset" :sizes="sizes" :width="width" :height="height" :alt="alt" :loading="loading" :fetchpriority="fetchpriority" decoding="async" @load="$emit('load')" @error="useFallback">
  </template>
</template>

<style scoped>
.asset-media-picture {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
