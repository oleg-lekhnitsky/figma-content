<script setup lang="ts">
import type { AssetMasonryItem } from '~/types/asset-masonry'
import type { VideoTemplate } from '~/types/video-composer'

const props = defineProps<{ template: VideoTemplate; assets: AssetMasonryItem[] }>()
const emit = defineEmits<{ ready: [value: string] }>()
const canvas = ref<HTMLCanvasElement>()
const assetRef = computed(() => props.assets)
const previewTitle = ref('Preset frame')
const { settings, setCanvas, drawAt, stop } = useVideoComposer(assetRef,previewTitle,props.template.id)
let cancelled=false
const queueHost=globalThis as typeof globalThis & { __videoPreviewQueue?: Promise<void> }

const nextPaint=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
const firstVisibleTime=()=>{
  if(props.template.collection==='scale')return Math.max(.05,Math.min(
    settings.value.visibleCount*settings.value.staggerSeconds-.001,
    settings.value.secondsPerSlide*.6+settings.value.staggerSeconds
  ))
  if(props.template.collection==='flicker')return Math.max(.01,settings.value.secondsPerSlide/Math.max(1,settings.value.visibleCount)*.5)
  return .001
}

onMounted(() => {
  const previewQueue=(queueHost.__videoPreviewQueue||Promise.resolve()).then(async()=>{
    if(cancelled||!canvas.value)return
    if(props.template.preset)Object.assign(settings.value,props.template.preset)
    settings.value.format='portrait-3-4';settings.value.visibleCount=Math.max(2,Math.min(40,props.assets.length||2))
    setCanvas(canvas.value);stop()
    // Let the settings and asset watchers finish their initial draw before the
    // snapshot draw becomes the final render revision.
    await nextTick();await nextPaint()
    if(cancelled)return
    await drawAt(firstVisibleTime());stop()
    if(!cancelled&&canvas.value)emit('ready',canvas.value.toDataURL('image/jpeg',.72))
  }).catch(()=>{})
  queueHost.__videoPreviewQueue=previewQueue
})
onBeforeUnmount(()=>{cancelled=true;stop()})
</script>

<template><canvas ref="canvas" class="video-preset-frame-canvas" /></template>
<style scoped>.video-preset-frame-canvas{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}</style>
