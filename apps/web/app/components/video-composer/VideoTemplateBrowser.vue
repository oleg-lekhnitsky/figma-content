<script setup lang="ts">
import type { VideoTemplate } from '~/types/video-composer'
import type { AssetMasonryItem } from '~/types/asset-masonry'
import { ChevronLeft } from 'reicon-vue'
import VideoPresetPreview from '~/components/video-composer/VideoPresetPreview.vue'

const props = defineProps<{ templates: VideoTemplate[]; modelValue: string; assets: AssetMasonryItem[] }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
type Folder = 'carousel' | 'carousel-3d' | 'grid' | 'orbit' | 'globe' | 'scale' | 'stories' | 'flicker' | 'test' | 'swipe-depth'
const folders: Array<{ id: Folder; label: string }> = [{ id: 'carousel', label: 'Carousel' }, { id: 'carousel-3d', label: 'Carousel 3D' }, { id: 'grid', label: 'Grid' }, { id: 'test', label: 'Flip Flop' }, { id: 'globe', label: 'Globe' }, { id: 'flicker', label: 'One Shot' }, { id: 'orbit', label: 'Orbit' }, { id: 'scale', label: 'Scale' }, { id: 'stories', label: 'Stories' }, { id: 'swipe-depth', label: 'Swipe Depth' }]
const openFolder = ref<Folder | null>(null)
const folderTemplates = (folder: Folder) => props.templates.filter(item => item.collection === folder)
const visibleTemplates = computed(() => openFolder.value ? folderTemplates(openFolder.value) : [])
const folderLabel = computed(() => folders.find(folder => folder.id === openFolder.value)?.label || 'Presets')
const previewing = ref<string | null>(null)
const startPreview = (event: PointerEvent, templateId: string) => {
  if (event.pointerType === 'mouse') previewing.value = templateId
}
const stopPreview = (event: PointerEvent) => {
  if (event.pointerType === 'mouse') previewing.value = null
}
let previousTouchY = 0
const startPanelTouch = (event: TouchEvent) => {
  previousTouchY = event.touches[0]?.clientY ?? 0
}
const containPanelTouch = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return
  const scroller = event.currentTarget as HTMLElement
  const deltaY = touch.clientY - previousTouchY
  previousTouchY = touch.clientY
  const atTop = scroller.scrollTop <= 0
  const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
  if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) event.preventDefault()
}
</script>

<template>
  <section class="video-panel video-template-browser">
    <div class="video-panel-scroll" @touchstart.passive="startPanelTouch" @touchmove="containPanelTouch">
      <header :class="{ 'has-back': openFolder }"><button v-if="openFolder" class="video-template-back" type="button"
          aria-label="Back to template collections" @click="openFolder = null">
          <ChevronLeft :size="18" weight="Outline" :stroke-width="2" aria-hidden="true" />
        </button>
        <h2 class="filter-overlay-title">{{ folderLabel }}</h2>
      </header>
      <div v-if="!openFolder" class="video-template-list video-template-root">
        <button v-for="template in templates.filter(item => !item.collection)" :key="template.id"
          class="video-template-featured" type="button" :aria-pressed="modelValue === template.id"
          @click="$emit('update:modelValue', template.id)">
          <VideoPresetPreview :template="template" :assets="assets" />
          <strong>{{ template.name }}</strong><small>{{ template.description }}</small>
        </button>
        <button v-for="folder in folders" :key="folder.id" class="video-template-folder" type="button"
          @click="openFolder = folder.id">
          <h3>{{ folder.label }}</h3>
        </button>
      </div>
      <div v-else class="video-template-list">
        <button v-for="template in visibleTemplates" :key="template.id" class="video-template-preset" type="button"
          :aria-pressed="modelValue === template.id" @pointerenter="startPreview($event, template.id)"
          @pointerleave="stopPreview" @click="$emit('update:modelValue', template.id)">
          <VideoPresetPreview :template="template" :assets="assets" :previewing="previewing === template.id" />
          <strong>{{ template.name }}</strong>
        </button>
      </div>
    </div>
  </section>
</template>
