<script setup lang="ts">
const props = defineProps<{ assetId: string }>()
const root = ref<HTMLElement>()
const video = ref<HTMLVideoElement>()
const visible = ref(false)
const failed = ref(false)
let observer: IntersectionObserver | undefined
const src = computed(() => `/api/assets/${encodeURIComponent(props.assetId)}/media?variant=original#t=0.001`)
onMounted(() => {
  observer = new IntersectionObserver(([entry]) => { visible.value = Boolean(entry?.isIntersecting) })
  if (root.value) observer.observe(root.value)
})
const releaseVideo = () => {
  if (!video.value) return
  video.value.pause()
  video.value.removeAttribute('src')
  video.value.load()
}
watch(visible, value => { if (!value) releaseVideo() }, { flush: 'sync' })
onBeforeUnmount(() => { observer?.disconnect(); releaseVideo() })
</script>

<template>
  <span ref="root" class="video-asset-frame">
    <video v-if="visible && !failed" ref="video" :src="src" muted playsinline preload="metadata" @error="failed = true" />
    <span v-else><slot /></span>
  </span>
</template>

<style scoped>
.video-asset-frame, .video-asset-frame video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover
}
.video-asset-frame > span {
  display: grid;
  height: 100%;
  place-items: center
}
</style>
