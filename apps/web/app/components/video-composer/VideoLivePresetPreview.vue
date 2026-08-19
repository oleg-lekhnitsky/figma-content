<script setup lang="ts">
import type { AssetMasonryItem } from '~/types/asset-masonry'
import type { VideoTemplate } from '~/types/video-composer'

const props = defineProps<{ template: VideoTemplate; assets: AssetMasonryItem[] }>()
const emit = defineEmits<{ ready: [] }>()
const canvas = ref<HTMLCanvasElement>()
const assetRef = computed(() => props.assets)
const previewTitle = ref('Preset preview')
const { settings, setCanvas, drawAt, seek, togglePlayback } = useVideoComposer(assetRef, previewTitle, props.template.id)

onMounted(async() => {
  if (props.template.preset) Object.assign(settings.value, props.template.preset)
  settings.value.format = 'portrait-3-4'
  if (canvas.value) setCanvas(canvas.value)
  await nextTick()
  const startTime=props.template.collection === 'scale' ? Math.max(.05,Math.min(
    settings.value.visibleCount*settings.value.staggerSeconds-.001,
    settings.value.secondsPerSlide*.6+settings.value.staggerSeconds
  )) : .001
  seek(startTime)
  await drawAt(startTime)
  emit('ready')
  togglePlayback()
})
</script>

<template>
  <canvas ref="canvas" class="video-live-preset-canvas" />
</template>

<style scoped>
.video-live-preset-canvas{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
</style>
