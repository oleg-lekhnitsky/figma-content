<script setup lang="ts">
import type { AssetMasonryItem } from '~/types/asset-masonry'
import { ArrowDown, ArrowUp, ChevronLeft, Download3, Eye, EyeOff, Menu4 } from 'reicon-vue'
import { videoTemplates } from '~/utils/video-templates'
import { readStoredVideoBackground, storeVideoBackground } from '~/utils/video-background'
import VideoCanvasInspector from '~/components/video-composer/VideoCanvasInspector.vue'
import VideoPreviewStage from '~/components/video-composer/VideoPreviewStage.vue'
import VideoSceneInspector from '~/components/video-composer/VideoSceneInspector.vue'
import VideoTemplateBrowser from '~/components/video-composer/VideoTemplateBrowser.vue'
import VideoTimeline from '~/components/video-composer/VideoTimeline.vue'

const props = defineProps<{ assets: AssetMasonryItem[]; boardTitle: string }>()
const emit = defineEmits<{ close: [] }>()
const assetOrder = ref<string[]>([])
const hiddenAssetIds = ref(new Set<string>())
const draggedAssetId = ref<string>()
const assetStatus = ref('')
const assetPreviewAttempts = ref<Record<string, number>>({})
type MobilePanel = 'templates' | 'scene' | 'canvas' | 'assets'
const mobilePanel = ref<MobilePanel | null>(null)
const mobilePanelTrigger = ref<HTMLElement | null>(null)
const mobilePanelClose = ref<HTMLButtonElement | null>(null)
const mobileSheetDragY = ref(0)
const mobileSheetHeight = ref(1)
const mobileSheetDragging = ref(false)
const mobileSheetDismissing = ref(false)
const mobileSheetBackdropOpacity = computed(() => Math.max(0, 1 - mobileSheetDragY.value / mobileSheetHeight.value))
const stageMotionReady = ref(false)
let mobileSheetPointerId: number | undefined
let mobileSheetTouchId: number | undefined
let mobileSheetTouchPending = false
let mobileSheetTouchStartX = 0
let mobileSheetTouchStartY = 0
let mobileSheetTouchScrollSource: HTMLElement | null = null
let mobileSheetStartY = 0
let mobileSheetLastY = 0
let mobileSheetLastTime = 0
let mobileSheetReleaseVelocity = 0
let mobileSheetMoved = false
let mobileSheetCloseTimer: ReturnType<typeof setTimeout> | undefined
const mobileSheetExitDuration = 120
let stageMotionFrame: number | undefined
let stopBackgroundPersistence: (() => void) | undefined
const openMobilePanel = async (panel: MobilePanel, event: MouseEvent) => {
  clearTimeout(mobileSheetCloseTimer)
  mobileSheetDragY.value = 0
  mobileSheetDragging.value = false
  mobileSheetDismissing.value = false
  mobilePanelTrigger.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  mobilePanel.value = panel
  await nextTick()
  const sheet = document.getElementById(`video-mobile-${panel}`)
  mobileSheetHeight.value = Math.max(1, sheet?.offsetHeight ?? window.innerHeight)
  mobilePanelClose.value?.focus()
}
const finishMobilePanelClose = async () => {
  if (!mobilePanel.value) return
  clearTimeout(mobileSheetCloseTimer)
  mobilePanel.value = null
  mobileSheetDragY.value = 0
  mobileSheetDragging.value = false
  mobileSheetDismissing.value = false
  mobileSheetPointerId = undefined
  await nextTick()
  mobilePanelTrigger.value?.focus()
}
const closeMobilePanel = () => {
  if (!mobilePanel.value || mobileSheetDismissing.value) return
  clearTimeout(mobileSheetCloseTimer)
  const panel = document.getElementById(`video-mobile-${mobilePanel.value}`)
  const sheetHeight = panel?.offsetHeight ?? Math.min(window.innerHeight * .5, 512)
  mobileSheetHeight.value = Math.max(1, sheetHeight)
  mobileSheetDragging.value = false
  mobileSheetPointerId = undefined
  resetMobileSheetTouch()
  mobileSheetDismissing.value = true
  requestAnimationFrame(() => { mobileSheetDragY.value = sheetHeight + 48 })
  mobileSheetCloseTimer = setTimeout(() => { void finishMobilePanelClose() }, mobileSheetExitDuration)
}
const startMobileSheetDrag = (event: PointerEvent) => {
  if (event.pointerType !== 'touch' || mobileSheetDismissing.value) return
  mobileSheetPointerId = event.pointerId
  mobileSheetStartY = event.clientY
  mobileSheetLastY = event.clientY
  mobileSheetLastTime = performance.now()
  mobileSheetReleaseVelocity = 0
  mobileSheetMoved = false
  mobileSheetDragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
const moveMobileSheetDrag = (event: PointerEvent) => {
  if (!mobileSheetDragging.value || event.pointerId !== mobileSheetPointerId) return
  event.preventDefault()
  const now = performance.now()
  const elapsed = now - mobileSheetLastTime
  if (elapsed > 0) mobileSheetReleaseVelocity = (event.clientY - mobileSheetLastY) / elapsed
  mobileSheetLastY = event.clientY
  mobileSheetLastTime = now
  mobileSheetDragY.value = Math.max(0, event.clientY - mobileSheetStartY)
  if (mobileSheetDragY.value > 4) mobileSheetMoved = true
}
const finishMobileSheetDrag = (event: PointerEvent) => {
  if (!mobileSheetDragging.value || event.pointerId !== mobileSheetPointerId) return
  const velocity = performance.now() - mobileSheetLastTime < 120 ? mobileSheetReleaseVelocity : 0
  mobileSheetDragging.value = false
  mobileSheetPointerId = undefined
  const sheetHeight = Math.min(window.innerHeight * .5, 512)
  if (mobileSheetDragY.value > Math.min(96, sheetHeight * .18) || velocity > .45) {
    closeMobilePanel()
    return
  }
  mobileSheetDragY.value = 0
}
const cancelMobileSheetDrag = (event: PointerEvent) => {
  if (!mobileSheetDragging.value || event.pointerId !== mobileSheetPointerId) return
  mobileSheetDragging.value = false
  mobileSheetPointerId = undefined
  mobileSheetDragY.value = 0
}
const handleMobileSheetHandleClick = (event: MouseEvent) => {
  if (mobileSheetMoved) {
    event.preventDefault()
    mobileSheetMoved = false
    return
  }
  void closeMobilePanel()
}
const findMobileSheetTouch = (touches: TouchList) => Array.from(touches).find(touch => touch.identifier === mobileSheetTouchId)
const resetMobileSheetTouch = () => {
  mobileSheetTouchId = undefined
  mobileSheetTouchPending = false
  mobileSheetTouchScrollSource = null
}
const startMobilePanelTouch = (event: TouchEvent) => {
  if (!mobilePanel.value || event.touches.length !== 1 || !(event.target instanceof HTMLElement)) return
  const panel = event.target.closest<HTMLElement>('.video-mobile-panel.is-mobile-open')
  const scrollSource = event.target.closest<HTMLElement>('.video-panel-scroll')
  if (!panel || !scrollSource || scrollSource.scrollTop > 0) return
  const touch = event.touches[0]
  if (!touch) return
  mobileSheetTouchId = touch.identifier
  mobileSheetTouchPending = true
  mobileSheetTouchStartX = touch.clientX
  mobileSheetTouchStartY = touch.clientY
  mobileSheetTouchScrollSource = scrollSource
  mobileSheetLastY = touch.clientY
  mobileSheetLastTime = performance.now()
  mobileSheetReleaseVelocity = 0
  mobileSheetMoved = false
}
const moveMobilePanelTouch = (event: TouchEvent) => {
  const touch = findMobileSheetTouch(event.touches)
  if (!touch) return
  const deltaX = touch.clientX - mobileSheetTouchStartX
  const deltaY = touch.clientY - mobileSheetTouchStartY
  if (mobileSheetTouchPending) {
    if (Math.abs(deltaX) > Math.abs(deltaY) || deltaY < 0 || (mobileSheetTouchScrollSource?.scrollTop ?? 0) > 0) {
      resetMobileSheetTouch()
      return
    }
    if (deltaY < 6) return
    mobileSheetTouchPending = false
    mobileSheetDragging.value = true
  }
  if (!mobileSheetDragging.value) return
  if (event.cancelable) event.preventDefault()
  const now = performance.now()
  const elapsed = now - mobileSheetLastTime
  if (elapsed > 0) mobileSheetReleaseVelocity = (touch.clientY - mobileSheetLastY) / elapsed
  mobileSheetLastY = touch.clientY
  mobileSheetLastTime = now
  mobileSheetDragY.value = Math.max(0, deltaY)
  if (mobileSheetDragY.value > 4) mobileSheetMoved = true
}
const finishMobilePanelTouch = (event: TouchEvent) => {
  if (!findMobileSheetTouch(event.changedTouches)) return
  if (mobileSheetTouchPending) {
    resetMobileSheetTouch()
    return
  }
  if (!mobileSheetDragging.value) return
  const velocity = performance.now() - mobileSheetLastTime < 120 ? mobileSheetReleaseVelocity : 0
  mobileSheetDragging.value = false
  resetMobileSheetTouch()
  const panel = document.getElementById(`video-mobile-${mobilePanel.value}`)
  const sheetHeight = panel?.offsetHeight ?? Math.min(window.innerHeight * .5, 512)
  if (mobileSheetDragY.value > Math.min(96, sheetHeight * .18) || velocity > .45) {
    closeMobilePanel()
    return
  }
  mobileSheetDragY.value = 0
}
const cancelMobilePanelTouch = () => {
  if (mobileSheetTouchId === undefined) return
  mobileSheetDragging.value = false
  mobileSheetDragY.value = 0
  resetMobileSheetTouch()
}
watch(() => props.assets.map(asset => asset.id), (ids) => {
  const available = new Set(ids)
  assetOrder.value = [...assetOrder.value.filter(id => available.has(id)), ...ids.filter(id => !assetOrder.value.includes(id))]
  hiddenAssetIds.value = new Set([...hiddenAssetIds.value].filter(id => available.has(id)))
}, { immediate: true })
watch(() => props.assets.map(asset => `${asset.id}:${asset.previewUrl}:${asset.originalUrl ?? ''}`), () => {
  assetPreviewAttempts.value = {}
})
const assetPreviewCandidates = (asset: AssetMasonryItem) => [...new Set([
  asset.previewUrl,
  `/api/assets/${encodeURIComponent(asset.id)}/media?variant=preview`,
  `/api/assets/${encodeURIComponent(asset.id)}/media?variant=original`,
  asset.originalUrl
].filter((url): url is string => Boolean(url)))]
const assetPreviewSrc = (asset: AssetMasonryItem) => assetPreviewCandidates(asset)[assetPreviewAttempts.value[asset.id] ?? 0]
const tryNextAssetPreview = (asset: AssetMasonryItem) => {
  const nextAttempt = (assetPreviewAttempts.value[asset.id] ?? 0) + 1
  assetPreviewAttempts.value = { ...assetPreviewAttempts.value, [asset.id]: nextAttempt }
}
const orderedAssets = computed(() => {
  const byId = new Map(props.assets.map(asset => [asset.id, asset]))
  return assetOrder.value.map(id => byId.get(id)).filter((asset): asset is AssetMasonryItem => Boolean(asset))
})
const activeAssets = computed(() => orderedAssets.value.filter(asset => !hiddenAssetIds.value.has(asset.id)))
const assetRef = computed(() => activeAssets.value)
const titleRef = computed(() => props.boardTitle)
const { settings, template, playing, exporting, progress, feedback, totalDuration, setCanvas, togglePlayback, seek, renderVideo } = useVideoComposer(assetRef, titleRef, 'flicker-01', { preserveDrawingBuffer:true })
const handleStageReady = (canvas: HTMLCanvasElement) => {
  stageMotionReady.value = false
  if (stageMotionFrame !== undefined) cancelAnimationFrame(stageMotionFrame)
  setCanvas(canvas)
  stageMotionFrame = requestAnimationFrame(() => {
    stageMotionFrame = requestAnimationFrame(() => { stageMotionReady.value = true })
  })
}
const handlePlaybackShortcut = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && mobilePanel.value) {
    event.preventDefault()
    void closeMobilePanel()
    return
  }
  if (event.key === 'Tab' && mobilePanel.value) {
    const panel = document.getElementById(`video-mobile-${mobilePanel.value}`)
    const panelControls = panel ? [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')] : []
    const controls = [mobilePanelClose.value, ...panelControls].filter((control): control is HTMLElement => Boolean(control))
    if (!controls.length) return
    const currentIndex = controls.indexOf(document.activeElement as HTMLElement)
    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault()
      controls.at(-1)?.focus()
    } else if (!event.shiftKey && currentIndex === controls.length - 1) {
      event.preventDefault()
      controls[0]?.focus()
    }
    return
  }
  if (event.code !== 'Space' || event.repeat || event.defaultPrevented) return
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('button, input, select, textarea, [contenteditable="true"]')) return
  event.preventDefault()
  togglePlayback()
}
onMounted(() => {
  window.addEventListener('keydown', handlePlaybackShortcut)
  const storedBackground = readStoredVideoBackground()
  if (storedBackground) Object.assign(settings.value, storedBackground)
  stopBackgroundPersistence = watch(
    () => ({
      backgroundType: settings.value.backgroundType,
      backgroundColor: settings.value.backgroundColor,
      backgroundGradientColor: settings.value.backgroundGradientColor,
      backgroundGradientAngle: settings.value.backgroundGradientAngle
    }),
    storeVideoBackground,
    { deep: true }
  )
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handlePlaybackShortcut)
  stopBackgroundPersistence?.()
  clearTimeout(mobileSheetCloseTimer)
  if (stageMotionFrame !== undefined) cancelAnimationFrame(stageMotionFrame)
})
const moveAsset = (assetId: string, targetId: string) => {
  if (assetId === targetId) return
  const next = [...assetOrder.value]
  const from = next.indexOf(assetId)
  const to = next.indexOf(targetId)
  if (from < 0 || to < 0) return
  next.splice(from, 1)
  next.splice(to, 0, assetId)
  assetOrder.value = next
  assetStatus.value = `Moved ${orderedAssets.value.find(asset => asset.id === assetId)?.title || 'asset'} to position ${to + 1}`
}
const moveAssetBy = (assetId: string, offset: number) => {
  const index = assetOrder.value.indexOf(assetId)
  const target = assetOrder.value[index + offset]
  if (target) moveAsset(assetId, target)
}
const beginAssetDrag = (event: DragEvent, asset: AssetMasonryItem) => {
  draggedAssetId.value = asset.id
  event.dataTransfer?.setData('text/plain', asset.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  const thumbnail = (event.currentTarget as HTMLElement)?.closest('li')?.querySelector('img')
  if (thumbnail instanceof HTMLImageElement && thumbnail.complete) event.dataTransfer?.setDragImage(thumbnail, thumbnail.width / 2, thumbnail.height / 2)
}
const previewAssetDrop = (targetId: string) => {
  if (draggedAssetId.value) moveAsset(draggedAssetId.value, targetId)
}
const toggleAsset = (asset: AssetMasonryItem) => {
  const next = new Set(hiddenAssetIds.value)
  if (next.has(asset.id)) next.delete(asset.id)
  else next.add(asset.id)
  hiddenAssetIds.value = next
  assetStatus.value = `${asset.title} ${next.has(asset.id) ? 'hidden' : 'shown'}`
}
const showAllAssets = () => {
  hiddenAssetIds.value = new Set()
  assetStatus.value = 'All assets shown'
}
</script>

<template>
  <div class="board-video-composer" :class="{ 'has-mobile-panel': mobilePanel, 'is-mobile-sheet-dragging': mobileSheetDragging, 'is-mobile-sheet-dismissing': mobileSheetDismissing, 'is-stage-motion-ready': stageMotionReady }" :style="{ '--video-mobile-sheet-drag-y': `${mobileSheetDragY}px`, '--sheet-backdrop-opacity': mobileSheetBackdropOpacity, '--sheet-content-opacity': mobileSheetBackdropOpacity }" @touchstart.passive="startMobilePanelTouch" @touchmove="moveMobilePanelTouch" @touchend="finishMobilePanelTouch" @touchcancel="cancelMobilePanelTouch">
    <header class="video-mobile-header">
      <button class="button-secondary button-icon video-mobile-header-back" type="button" aria-label="Close video editor" @click="emit('close')"><ChevronLeft :size="24" weight="Outline" aria-hidden="true" /></button>
      <h2>Video editor</h2>
      <button class="button-secondary video-mobile-header-export" type="button" :disabled="exporting || !activeAssets.length" :aria-label="exporting ? 'Rendering video' : 'Export video'" @click="renderVideo"><span>{{ exporting ? 'Rendering…' : 'Export' }}</span></button>
    </header>
    <main class="video-composer-center">
      <VideoPreviewStage :key="template.renderer" :safe-area="settings.safeArea" :playing="playing" @ready="handleStageReady" @toggle="togglePlayback" />
    </main>
    <nav class="video-mobile-toolbar" aria-label="Video editing tools">
      <button type="button" aria-controls="video-mobile-templates" :aria-expanded="mobilePanel === 'templates'" @click="openMobilePanel('templates', $event)">Templates</button>
      <button type="button" aria-controls="video-mobile-scene" :aria-expanded="mobilePanel === 'scene'" @click="openMobilePanel('scene', $event)">Settings</button>
      <button type="button" aria-controls="video-mobile-canvas" :aria-expanded="mobilePanel === 'canvas'" @click="openMobilePanel('canvas', $event)">Canvas</button>
      <button type="button" aria-controls="video-mobile-assets" :aria-expanded="mobilePanel === 'assets'" @click="openMobilePanel('assets', $event)">Assets</button>
    </nav>
    <button v-if="mobilePanel" class="video-mobile-backdrop" type="button" aria-label="Close video settings" data-drawer-gesture-boundary @click="closeMobilePanel" />
    <VideoTemplateBrowser id="video-mobile-templates" v-model="settings.templateId" class="video-mobile-panel" :class="{ 'is-mobile-open': mobilePanel === 'templates' }" :role="mobilePanel === 'templates' ? 'dialog' : undefined" :aria-modal="mobilePanel === 'templates' || undefined" aria-label="Choose a video template" data-drawer-gesture-boundary :templates="videoTemplates" :assets="activeAssets" />
    <VideoSceneInspector id="video-mobile-scene" v-model="settings" class="video-mobile-panel" :class="{ 'is-mobile-open': mobilePanel === 'scene' }" :role="mobilePanel === 'scene' ? 'dialog' : undefined" :aria-modal="mobilePanel === 'scene' || undefined" aria-label="Video settings" data-drawer-gesture-boundary :template="template" />
    <aside class="video-composer-right">
      <VideoCanvasInspector id="video-mobile-canvas" v-model="settings" class="video-mobile-panel" :class="{ 'is-mobile-open': mobilePanel === 'canvas' }" :role="mobilePanel === 'canvas' ? 'dialog' : undefined" :aria-modal="mobilePanel === 'canvas' || undefined" aria-label="Canvas settings" data-drawer-gesture-boundary />
      <section id="video-mobile-assets" class="video-panel video-assets-panel video-mobile-panel" :class="{ 'is-mobile-open': mobilePanel === 'assets' }" :role="mobilePanel === 'assets' ? 'dialog' : undefined" :aria-modal="mobilePanel === 'assets' || undefined" aria-label="Video assets" data-drawer-gesture-boundary>
        <div class="video-panel-scroll">
        <header>
          <h2 class="filter-overlay-title">Assets</h2><span>{{ activeAssets.length }}/{{ assets.length }}</span>
        </header>
        <ol>
          <li v-for="asset in orderedAssets" :key="asset.id" :class="{ 'is-hidden': hiddenAssetIds.has(asset.id), 'is-dragging': draggedAssetId === asset.id }" @dragenter.prevent="previewAssetDrop(asset.id)" @dragover.prevent="$event.dataTransfer && ($event.dataTransfer.dropEffect = 'move')" @drop.prevent="draggedAssetId = undefined">
            <button class="video-asset-handle" type="button" draggable="true" :aria-label="`Reorder ${asset.title}. Use Alt and arrow keys to move.`" @dragstart="beginAssetDrag($event, asset)" @dragend="draggedAssetId = undefined" @keydown.alt.up.prevent="moveAssetBy(asset.id, -1)" @keydown.alt.down.prevent="moveAssetBy(asset.id, 1)"><Menu4 :size="16" aria-hidden="true" /></button>
            <span class="video-asset-thumbnail" aria-hidden="true">
              <img v-if="assetPreviewSrc(asset)" :key="assetPreviewSrc(asset)" :src="assetPreviewSrc(asset)" alt="" @error="tryNextAssetPreview(asset)">
              <span v-else>{{ asset.title.trim().charAt(0) || '·' }}</span>
            </span><span>{{ asset.title }}</span>
            <span class="video-asset-mobile-order">
              <button type="button" :disabled="assetOrder[0] === asset.id" :aria-label="`Move ${asset.title} earlier`" @click="moveAssetBy(asset.id, -1)"><ArrowUp :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /></button>
              <button type="button" :disabled="assetOrder[assetOrder.length - 1] === asset.id" :aria-label="`Move ${asset.title} later`" @click="moveAssetBy(asset.id, 1)"><ArrowDown :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /></button>
            </span>
            <button class="video-asset-visibility" type="button" :aria-label="hiddenAssetIds.has(asset.id) ? `Show ${asset.title}` : `Hide ${asset.title}`" :aria-pressed="!hiddenAssetIds.has(asset.id)" @click="toggleAsset(asset)"><EyeOff v-if="hiddenAssetIds.has(asset.id)" :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /><Eye v-else :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /></button>
          </li>
        </ol>
        <button v-if="hiddenAssetIds.size" class="video-assets-show-all" type="button" @click="showAllAssets">Show all</button>
        <p class="sr-only" role="status" aria-live="polite">{{ assetStatus }}</p>
        </div>
      </section>
    </aside>
    <button v-if="mobilePanel" ref="mobilePanelClose" class="video-mobile-sheet-handle" type="button" aria-label="Close video settings" data-drawer-gesture-boundary @pointerdown="startMobileSheetDrag" @pointermove="moveMobileSheetDrag" @pointerup="finishMobileSheetDrag" @pointercancel="cancelMobileSheetDrag" @click="handleMobileSheetHandleClick"><span aria-hidden="true" /></button>
    <VideoTimeline :progress="progress" :duration="totalDuration" :playing="playing" @seek="seek" @toggle="togglePlayback">
      <p role="status" aria-live="polite">{{ feedback }}</p>
      <button class="button-primary video-export-button video-export-button--timeline" type="button" :disabled="exporting || !activeAssets.length" :aria-label="exporting ? 'Rendering video' : 'Download video'" :title="exporting ? 'Rendering video' : 'Download video'" @click="renderVideo"><Download3 class="video-export-icon" :size="20" weight="Outline" aria-hidden="true" /><span class="video-export-label">{{ exporting ? 'Rendering…' : 'Export video' }}</span></button>
    </VideoTimeline>
  </div>
</template>

<style scoped>
.board-video-composer {
  --video-panel-radius: clamp(1.25rem, 2vw, 2rem);
  --video-type-caption: var(--font-size-caption);
  --video-type-body: var(--font-size-label);
  --video-weight-regular: 500;
  --video-weight-strong: 600;
  --video-text-muted: color-mix(in srgb, var(--filter-overlay-panel-color) 58%, transparent);
  --video-text-secondary: color-mix(in srgb, var(--filter-overlay-panel-color) 72%, transparent);
  --video-range-label-color: color-mix(in srgb, var(--filter-overlay-panel-color) 88%, transparent);
  --video-range-value-color: color-mix(in srgb, var(--filter-overlay-panel-color) 76%, transparent);
  --video-control-height: 40px;
  --video-inspector-section-gap: calc(var(--space)*.75);
  --video-inspector-control-gap: .5rem;
  --video-inspector-pair-gap: calc(var(--space)/2);
  display: grid;
  grid-template-columns: minmax(190px, .62fr) minmax(190px, .68fr) minmax(360px, 1.5fr) minmax(210px, .7fr);
  grid-template-rows: minmax(0, 1fr) auto;
  gap: calc(var(--space)/2);
  align-items: stretch;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0 auto;
  padding: var(--space);
  border-radius: var(--radius);
  color: var(--filter-overlay-panel-color)
}

.video-composer-heading {
  grid-column: 1/-1;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space)
}

.video-composer-heading p,
.video-composer-heading h2 {
  margin: 0
}

.video-composer-heading>p {
  max-width: 44ch;
  opacity: .68
}

.video-composer-heading>div>p {
  font-size: var(--font-size-label);
  opacity: .62
}

.video-composer-center {
  grid-column: 3;
  grid-row: 1;
  display: grid;
  gap: calc(var(--space)/2);
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.board-video-composer > :deep(.video-template-browser) {
  grid-column: 1;
  grid-row: 1
}

.board-video-composer > :deep(.video-inspector) {
  grid-column: 2;
  grid-row: 1
}

.video-composer-right {
  grid-column: 4;
  grid-row: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: calc(var(--space)/2);
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.video-composer-right :deep(.video-panel:first-child) {
  height: auto
}

.video-assets-panel ol {
  display: grid;
  align-content: start;
  gap: calc(var(--space)/4);
  height: auto;
  min-height: max-content;
  max-height: none;
  margin: 0;
  padding: 0;
  overflow: visible;
  scrollbar-width: none;
  list-style: none
}

.video-assets-panel ol::-webkit-scrollbar {
  display: none
}

.video-assets-panel :deep(.video-panel-scroll) {
  display: grid;
  grid-template-rows: repeat(4, max-content);
  align-content: start;
  overflow-x: hidden;
  overflow-y: auto
}

.video-assets-panel li {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 24px 38px minmax(0, 1fr) 32px;
  align-items: center;
  gap: calc(var(--space)/2);
  min-height: 44px;
  padding: 3px 6px;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  font-size: var(--video-type-body);
  font-weight: var(--video-weight-strong);
  transition: opacity 150ms ease-out, background-color 150ms ease-out
}

.video-assets-panel li:hover {
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 11%, transparent)
}

.video-asset-mobile-order {
  display: none
}

.video-assets-panel li.is-hidden {
  opacity: .42
}

.video-assets-panel li.is-dragging {
  opacity: .24
}

.video-assets-panel li:has(.video-asset-handle:focus-visible),
.video-assets-panel li:has(.video-asset-visibility:focus-visible) {
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 14%, transparent)
}

.video-asset-thumbnail {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: calc(var(--radius)/3);
  background: color-mix(in srgb, currentColor 12%, transparent)
}

.video-asset-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover
}

.video-asset-thumbnail > span {
  font-size: var(--video-type-body);
  font-weight: var(--video-weight-strong);
  opacity: .72
}

.video-asset-handle,
.video-asset-visibility {
  position: relative;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: inherit;
  background: transparent
}

.video-asset-handle {
  width: 24px;
  cursor: grab
}

.video-asset-handle:active {
  cursor: grabbing
}

.video-asset-handle:focus-visible,
.video-asset-visibility:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 1px
}

.video-assets-show-all {
  width: 100%;
  min-height: var(--video-control-height);
  margin-top: calc(var(--space)/2);
  padding: 0 12px;
  border: 0;
  border-radius: calc(var(--radius)*1.5);
  color: inherit;
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  font-size: var(--video-type-body);
  font-weight: var(--video-weight-strong);
  transition-property: background-color, transform;
  transition-duration: 120ms;
  transition-timing-function: ease-out
}

.video-assets-show-all:hover {
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 11%, transparent)
}

.video-assets-show-all:active {
  transform: scale(.96)
}

.video-assets-show-all:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0
}

:deep(.video-panel) {
  height: 100%;
  max-height: none;
  overflow: hidden;
  overscroll-behavior: contain;
  scrollbar-width: none;
  border: 0;
  border-radius: var(--video-panel-radius);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-panel-background);
  backdrop-filter: none;
  -webkit-backdrop-filter: none
}

:deep(.video-panel-scroll) {

  max-height: 100%;
  align-content: start;
  padding: var(--space);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

:deep(.video-panel-scroll::-webkit-scrollbar) {
  display: none
}

:deep(.video-panel header) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: flex;
  min-height: 26px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  margin-bottom: calc(var(--space)*.75)
}

:deep(.video-panel header h2) {
  min-width: 0;
  max-width: 100%;
  flex: 1 1 auto
}

:deep(.video-panel header span) {
  flex: 0 0 auto;
  color: var(--video-text-muted);
  font-size: var(--video-type-caption);
  font-weight: var(--video-weight-regular);
  line-height: 1
}

:deep(.video-template-list) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(var(--space)/3);
}

:deep(.video-template-list>button) {
  width: 100%;
  min-height: 0;
  touch-action: manipulation;
  padding: calc(var(--space)/4);
  border: 1px solid transparent;
  border-radius: calc(var(--radius)*1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  color: inherit;
  text-align: left;
  transition-property: background-color, border-color, transform;
  transition-duration: 150ms;
  transition-timing-function: ease-out
}

:deep(.video-template-list>button:hover) {
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 11%, transparent)
}

:deep(.video-template-list>button:active) {
  transform: scale(.96)
}

:deep(.video-template-list>button[aria-pressed=true]) {
  border-color: rgb(255 255 255/.62);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 14%, transparent)
}

:deep(.video-template-featured) {
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 2px calc(var(--space)/3)
}

:deep(.video-template-featured .video-template-thumb) {
  grid-row: 1/3;
  width: 54px;
  height: 68px
}

:deep(.video-template-preset .video-template-thumb) {
  display: block;
  width: 100%;
  aspect-ratio: 3/4
}

:deep(.video-template-thumb) {
  border-radius: calc(var(--radius)*1.5)
}

:deep(.video-template-list strong) {
  display: block;
  margin-top: 6px;
  font-size: var(--video-type-caption);
  font-weight: var(--video-weight-strong);
  text-align: center
}

:deep(.video-template-featured strong) {
  align-self: end;
  margin: 0;
  font-size: var(--video-type-body);
  text-align: left
}

:deep(.video-template-list small) {
  display: -webkit-box;
  overflow: hidden;
  color: var(--video-text-muted);
  font-size: var(--video-type-caption);
  font-weight: var(--video-weight-regular);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2
}

:deep(.video-template-group) {
  grid-column: 1/-1;
  margin: calc(var(--space)/3) 0 0;
  color: var(--video-text-muted);
  font-size: var(--video-type-caption);
  font-weight: var(--video-weight-strong);
  text-transform: uppercase;
  letter-spacing: .08em;
  opacity: 1
}

:deep(.video-template-root) {
  grid-template-columns: 1fr;
  margin-top: calc(var(--space)*1.5);
}

:deep(.video-template-list > .video-template-folder) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: calc(var(--space)*.625) calc(var(--space)*.75);
}

:deep(.video-template-folder h3) {
  margin: 0;
  font-size: var(--filter-title-size);
  font-weight: 500;
  letter-spacing: -.04em;
  line-height: 1;
  text-align: left
}

:deep(.video-template-browser>.video-panel-scroll>header) {
  grid-template-columns: minmax(0, 1fr);
  display: grid;
  align-items: center;
  gap: 0
}

:deep(.video-template-browser>.video-panel-scroll>header.has-back) {
  grid-template-columns: 32px minmax(0, 1fr) 32px
}

:deep(.video-template-back) {
  width: 26px;
  min-width: 26px;
  min-height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

:deep(.video-template-browser>.video-panel-scroll>header .video-template-back) {
  grid-column: 1
}

:deep(.video-template-browser>.video-panel-scroll>header h2) {
  grid-column: 1;
  margin: 0;
  text-align: left
}

:deep(.video-template-browser>.video-panel-scroll>header.has-back h2) {
  grid-column: 2;
  text-align: center
}

:deep(.video-inspector>.video-panel-scroll) {
  display: grid;
  gap: var(--video-inspector-section-gap)
}

:deep(.video-inspector) {
  container-type: inline-size
}

@container (min-width: 32rem) {
  :deep(.video-inspector>.video-panel-scroll) {
    grid-template-columns: repeat(2, minmax(0, 1fr))
  }

  :deep(.video-inspector>.video-panel-scroll>header),
  :deep(.video-inspector>.video-panel-scroll>.video-control-pair),
  :deep(.video-inspector>.video-panel-scroll>.video-reset),
  :deep(.video-inspector>.video-panel-scroll>fieldset:has(> .video-control-pair)),
  :deep(.video-inspector>.video-panel-scroll>fieldset:has(.video-choice-row button:nth-child(4))) {
    grid-column: 1 / -1
  }
}

:deep(.video-inspector>.video-panel-scroll>header) {
  margin-bottom: 0
}

:deep(.video-inspector fieldset) {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0
}

:deep(.video-inspector legend),
:deep(.video-inspector label) {
  display: grid;
  gap: .375rem;
  color: var(--video-text-secondary);
  font-size: var(--video-type-body);
  font-weight: var(--video-weight-strong)
}

:deep(.video-choice-row) {
  display: flex;
  flex-wrap: wrap;
  gap: var(--filter-option-gap);
  margin-top: var(--video-inspector-control-gap)
}

:deep(.video-choice-row:not(:has(button:nth-child(6)))) {
  box-sizing: border-box;
  width: 100%;
  height: var(--video-control-height) !important;
  min-height: var(--video-control-height) !important;
  max-height: var(--video-control-height) !important;
  flex-wrap: nowrap;
  gap: 2px;
  padding: 4px;
  border-radius: calc(var(--radius)*1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent)
}

:deep(.video-choice-row:not(:has(button:nth-child(6))) button) {
  min-width: 0;
  height: calc(var(--video-control-height) - 8px) !important;
  min-height: calc(var(--video-control-height) - 8px) !important;
  max-height: calc(var(--video-control-height) - 8px) !important;
  flex: 1 1 0;
  padding: 0 8px;
  padding-block: 0 !important;
  border: 0;
  border-radius: calc(var(--radius)*1.5 - 4px);
  color: var(--video-text-muted);
  background: transparent;
  box-shadow: none;
  transition-property: color, background-color, transform;
  transition-duration: 120ms;
  transition-timing-function: ease-out
}

:deep(.video-choice-row:not(:has(button:nth-child(6))) button:hover) {
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent)
}

:deep(.video-choice-row:not(:has(button:nth-child(6))) button[aria-pressed=true]) {
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background)
}

:deep(.video-choice-row:not(:has(button:nth-child(6))) button:active) {
  transform: scale(.96)
}

:deep(.video-choice-row:not(:has(button:nth-child(6))) button:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: -2px
}

:deep(.video-inspector fieldset>.video-control-pair) {
  margin-top: var(--video-inspector-control-gap)
}

:deep(.video-choice-row button:disabled) {
  opacity: .35
}

:deep(.video-inspector label>span) {
  display: flex;
  justify-content: space-between;
  gap: 8px
}

:deep(.video-inspector output) {
  font-variant-numeric: tabular-nums;
  font-size: var(--video-type-body);
  font-weight: var(--video-weight-regular);
  color: var(--video-text-muted);
  opacity: 1
}

:deep(.video-inspector input[type=range]) {
  width: 100%;
  margin: 0;
  accent-color: currentColor
}

:deep(.video-hex-color) {
  position: relative;
  display: grid;
  gap: var(--video-inspector-control-gap)
}

.video-composer-right > :deep(.video-inspector:first-child),
.video-composer-right > :deep(.video-inspector:first-child > .video-panel-scroll) {
  overflow: visible
}

.video-composer-right > :deep(.video-inspector:first-child) {
  position: relative;
  isolation: isolate;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none
}

.video-composer-right > :deep(.video-inspector:first-child)::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background: var(--filter-overlay-panel-background);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  content: '';
  pointer-events: none
}

:deep(.video-hex-color-field) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  max-width: 100%;
  height: var(--video-control-height);
  padding: 4px 10px;
  border: 0;
  border-radius: calc(var(--radius)*1.5);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  color: var(--video-range-value-color)
}

:deep(.video-hex-color-swatch) {
  box-sizing: border-box;
  width: 24px;
  min-width: 24px;
  max-width: 24px;
  height: 24px;
  min-height: 24px;
  max-height: 24px;
  flex: 0 0 24px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px oklch(0 0 0/.1);
  cursor: pointer
}

:deep(.video-hex-color input) {
  width: 6.5ch;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit
}

:deep(.video-hex-color-field:has(input:focus-visible)) {
  outline: 2px solid currentColor;
  outline-offset: 2px
}

:deep(.video-hex-color-swatch:focus-visible),
:deep(.video-hex-palette button:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: 2px
}

:deep(.video-hex-palette) {
  position: absolute;
  z-index: 20;
  right: 0;
  bottom: calc(100% + 6px);
  left: 0;
  display: grid;
  box-sizing: border-box;
  width: 100%;
  gap: var(--video-inspector-control-gap);
  padding: calc(var(--video-inspector-control-gap)*2);
  padding-bottom: calc(var(--video-inspector-control-gap)*2.5);
  border-radius: calc(var(--radius) + var(--video-inspector-control-gap)*2);
  background: var(--filter-overlay-panel-background);
  backdrop-filter: blur(var(--filter-control-blur)) saturate(var(--material-tinted-saturation));
  -webkit-backdrop-filter: blur(var(--filter-control-blur)) saturate(var(--material-tinted-saturation));
  box-shadow: 0 10px 30px oklch(0 0 0/.18)
}

:deep(.video-color-picker-toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  color: var(--video-range-value-color);
  font-variant-numeric: tabular-nums
}

:deep(.video-color-picker-toolbar button) {
  display: grid;
  box-sizing: border-box;
  width: 28px;
  min-width: 28px;
  max-width: 28px;
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  flex: 0 0 28px;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  place-items: center;
  background: color-mix(in srgb, currentColor 8%, transparent);
  color: inherit;
  line-height: 1;
  cursor: pointer
}

:deep(.video-color-picker-toolbar svg) {
  width: 16px;
  height: 16px
}

:deep(.video-color-spectrum) {
  position: relative;
  height: 150px;
  overflow: hidden;
  border-radius: var(--radius);
  background:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent),
    hsl(var(--video-picker-hue) 100% 50%);
  cursor: crosshair;
  touch-action: none
}

:deep(.video-color-spectrum:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: 2px
}

:deep(.video-color-spectrum-handle) {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 999px;
  box-shadow: 0 0 0 1px oklch(0 0 0/.5);
  translate: -50% -50%;
  pointer-events: none
}

:deep(.video-color-hue) {
  display: block
}

:deep(.video-color-hue input[type=range]) {
  width: 100%;
  height: 14px;
  margin: 0;
  border-radius: 999px;
  background: linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);
  appearance: none
}

:deep(.video-color-hue input[type=range]::-webkit-slider-thumb) {
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-radius: 999px;
  background: transparent;
  box-shadow: 0 0 0 1px oklch(0 0 0/.5);
  appearance: none
}

:deep(.video-color-hue input[type=range]::-moz-range-thumb) {
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 999px;
  background: transparent;
  box-shadow: 0 0 0 1px oklch(0 0 0/.5)
}

:deep(.video-inspector label:has(> .video-range-input)) {
  position: relative;
  display: block;
  min-height: var(--video-control-height)
}

:deep(.video-inspector label:has(> .video-range-input)>span) {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: flex;
  align-items: center;
  min-height: var(--video-control-height);
  padding: 0 var(--filter-option-padding);
  color: var(--video-range-label-color);
  font-size: var(--video-type-body);
  line-height: 1;
  white-space: nowrap;
  pointer-events: none
}

:deep(.video-inspector label:has(> .video-range-input) output) {
  display: inline-flex;
  align-items: center;
  max-width: 50%;
  flex: 0 1 auto;
  min-width: 0;
  min-height: 20px;
  margin-left: auto;
  padding-left: 4px;
  overflow: hidden;
  border-radius: 6px;
  color: var(--video-range-value-color);
  text-overflow: ellipsis;
}

:deep(.video-control-pair) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--video-inspector-pair-gap);
  row-gap: var(--video-inspector-section-gap)
}

:deep(.video-stage) {
  position: relative;
  display: grid;
  box-sizing: border-box;
  place-items: center;
  height: 100%;
  min-height: min(66vh, 720px);
  padding: var(--space);
  overflow: hidden;
  border: 0;
  border-radius: var(--video-panel-radius);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-panel-background);
  backdrop-filter: blur(var(--filter-control-blur)) saturate(var(--material-tinted-saturation));
  -webkit-backdrop-filter: blur(var(--filter-control-blur)) saturate(var(--material-tinted-saturation))
}

:deep(.video-stage canvas) {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--color-bg);
}

:deep(.video-canvas-wrap) {
  position: relative;
  display: grid;
  place-items: center;
  width: 0;
  height: 0;
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--radius)
}

:deep(.video-stage-controls) {
  position: relative;
  grid-area: 1 / 1;
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  touch-action: manipulation
}

:deep(.video-canvas-wrap) {
  grid-area: 1 / 1
}

:deep(.video-stage-play) {
  display: none
}

:deep(.video-safe-area) {
  position: absolute;
  inset: 10%;
  border: 1px dashed rgb(255 255 255/.72);
  border-radius: calc(var(--radius)/3);
  pointer-events: none
}

:deep(.video-timeline) {
  grid-column: 1/-1;
  z-index: 3;
  bottom: var(--space);
  display: grid;
  grid-template-columns: 44px auto minmax(0, 1fr) auto;
  align-items: center;
  gap: calc(var(--space)*1);
  min-height: 0;
  padding: calc(var(--space)/2);
  border-radius: var(--video-panel-radius);
  color: var(--filter-overlay-panel-color);
  background: var(--filter-overlay-panel-background);
  backdrop-filter: blur(var(--filter-control-blur)) saturate(var(--material-tinted-saturation));
  -webkit-backdrop-filter: blur(var(--filter-control-blur)) saturate(var(--material-tinted-saturation))
}

:deep(.video-timeline-play) {
  width: 44px;
  min-height: 44px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background)
}

:deep(.video-timeline-time) {
  min-width: 9ch;
  color: var(--video-text-muted);
  font-size: var(--video-type-body);
  font-weight: var(--video-weight-strong);
  font-variant-numeric: tabular-nums;
  white-space: nowrap
}

:deep(.video-timeline-ruler) {
  position: relative;
  min-width: 0;
  height: 44px
}

:deep(.video-timeline-scale) {
  position: absolute;
  inset: 0 6px;
  color: var(--video-text-muted);
  font-size: var(--video-type-caption);
  font-weight: var(--video-weight-regular);
  pointer-events: none
}

:deep(.video-timeline-scale>span) {
  position: absolute;
  display: block
}

:deep(.video-timeline-dot) {
  top: 22px;
  width: 2px;
  height: 2px;
  translate: -50% 0;
  border-radius: 50%;
  background: currentColor
}

:deep(.video-timeline-label) {
  top: 50%;
  translate: 0 -50%;
  font-size: var(--video-type-body);
  white-space: nowrap
}

:deep(.video-timeline-playhead) {
  position: absolute;
  z-index: 1;
  top: 19px;
  bottom: -14px;
  left: var(--timeline-progress);
  width: 1px;
  background: currentColor;
  pointer-events: none
}

:deep(.video-timeline input) {
  display: block;
  width: 100%;
  height: 20px;
  margin: 20px 0 0;
  padding: 0;
  appearance: none;
  border: 0;
  border-radius: 0;
  outline: 0;
  background: transparent;
  box-shadow: none;
  cursor: pointer
}

:deep(.video-timeline input:focus),
:deep(.video-timeline input:focus-visible) {
  border: 0;
  outline: 0;
  box-shadow: none
}

:deep(.video-timeline input::-webkit-slider-runnable-track) {
  height: 5px;
  border-radius: 3px;
  background: transparent
}

:deep(.video-timeline input::-webkit-slider-thumb) {
  width: 12px;
  height: 12px;
  margin-top: -3.5px;
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: transparent
}

:deep(.video-timeline input::-moz-range-track) {
  height: 5px;
  border-radius: 3px;
  background: transparent
}

:deep(.video-timeline input::-moz-range-progress) {
  height: 5px;
  background: transparent
}

:deep(.video-timeline input::-moz-range-thumb) {
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 999px;
  background: transparent
}

:deep(.video-timeline-actions) {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: calc(var(--space)/2)
}

:deep(.video-timeline-actions::before) {
  content: '';
  width: 1px;
  height: 28px;
  background: rgb(255 255 255/.18)
}

:deep(.video-timeline-actions p) {
  margin: 0;
  color: var(--video-text-muted);
  font-size: var(--video-type-body);
  font-weight: var(--video-weight-regular)
}

:deep(.video-timeline-actions button) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap
}

:deep(.video-timeline-actions button:disabled) {
  cursor: wait;
  opacity: .5
}

.video-export-icon {
  display: none
}

:deep(.video-template-preset),
:deep(.video-template-preset:hover),
:deep(.video-template-preset:focus-visible),
:deep(.video-template-preset:active) {
  transform: none !important
}

.video-mobile-toolbar,
.video-mobile-backdrop,
.video-mobile-sheet-handle,
.video-mobile-header {
  display: none
}

@media(max-width:1180px) {
  .board-video-composer {
    height: auto;
    min-height: calc(100% - var(--space)*2);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto;
    align-items: start
  }

  :deep(.video-panel) {
    height: auto;
    max-height: calc(100% - 180px)
  }

  :deep(.video-panel-scroll) {
    height: auto;
    max-height: inherit
  }

  .video-composer-center {
    grid-column: 1/-1;
    grid-row: 1
  }

  .board-video-composer > :deep(.video-template-browser) {
    grid-column: 1;
    grid-row: 2
  }

  .board-video-composer > :deep(.video-inspector) {
    grid-column: 2;
    grid-row: 2
  }

  .video-composer-right {
    display: contents
  }

}

@media(max-width:1180px) {
  :global(.selection-panel--filter-overlay:has(.board-video-composer)) {
    display: block;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;

  }

  :global(.selection-panel--filter-overlay:has(.board-video-composer.has-mobile-panel)) {
    overflow-y: hidden !important;
    overscroll-behavior-y: none;
  }

  :deep(.video-template-list > .video-template-folder) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: calc(var(--space)*1.5) calc(var(--space)*1.5);
}

  .board-video-composer {
    --video-mobile-sheet-height: min(48dvh, 32rem);
    --video-input-gap-mobile: calc(var(--space) / .75);
    --video-type-body: var(--font-size-body);
    --video-control-height: var(--range-control-height-mobile);
    position: relative;
    box-sizing: border-box;
    height: 100%;
    max-height: 100%;
    min-height: 0;
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    gap: calc(var(--space)/2);
    padding: max(var(--space), env(safe-area-inset-top)) calc(var(--space)/1) max(calc(var(--space)/2), env(safe-area-inset-bottom));
    overflow: hidden;
    border-radius: var(--radius-mobile);
  }

  .board-video-composer.has-mobile-panel {
    grid-template-rows: auto minmax(0, 1fr);
    row-gap: var(--space);
    padding-bottom: calc(var(--video-mobile-sheet-height) + var(--space))
  }

  .board-video-composer.has-mobile-panel > .video-composer-center {
    position: relative;
    z-index: 41;
    grid-column: 1;
    grid-row: 2;
    width: 100%;
    height: 100%;
    align-self: auto
  }

  .board-video-composer.has-mobile-panel > .video-mobile-header {
    z-index: 41
  }

  .board-video-composer.has-mobile-panel > .video-composer-center :deep(.video-stage) {
    place-items: start center
  }

  .board-video-composer.has-mobile-panel > :deep(.video-timeline),
  .board-video-composer.has-mobile-panel > .video-mobile-toolbar {
    display: none
  }

  .board-video-composer > *,
  .video-composer-center,
  .video-composer-right,
  :deep(.video-panel),
  :deep(.video-panel-scroll),
  :deep(.video-template-list),
  :deep(.video-timeline) {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    
  }

  .video-composer-center {
    grid-column: 1;
    grid-row: 2;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    order: 1
  }

  .video-mobile-header {
    position: relative;
    z-index: 2;
    grid-column: 1;
    grid-row: 1;
    order: 0;
    display: grid;
    grid-template-columns: var(--control-height) minmax(0, 1fr) auto;
    align-items: center;
    gap: calc(var(--space)/2);
    min-height: var(--control-height);
    color: var(--color-muted)
  }

  .video-mobile-header h2 {
    position: absolute;
    left: 50%;
    margin: 0;
    overflow: hidden;
    font-size: var(--font-size-body);
    font-weight: var(--video-weight-strong);
    line-height: 1;
    text-align: center;
    text-overflow: ellipsis;
    translate: -50% 0;
    white-space: nowrap
  }

  .video-mobile-header-export {
    grid-column: 3;
    justify-self: end;
    height: var(--control-height);
    min-height: var(--control-height)
  }

  .video-mobile-header-back {
    width: var(--control-height);
    min-height: var(--control-height);
    display: grid;
    place-items: center;
    padding: 0;
    touch-action: manipulation;
    pointer-events: auto
  }

  :deep(.video-timeline) {
    grid-column: 1;
    grid-row: 3;
    order: 2
  }

  .video-mobile-toolbar {
    z-index: 4;
    grid-column: 1;
    grid-row: 4;
    order: 3;
    display: flex;
    justify-content: space-between;
    gap: 2px;
    padding: 4px var(--filter-option-padding);
    border-radius: calc(var(--radius)*1.5);
    color: var(--filter-overlay-panel-color);
    background: var(--filter-overlay-panel-background-mobile);
    backdrop-filter: blur(var(--filter-control-blur)) saturate(var(--material-tinted-saturation));
    -webkit-backdrop-filter: blur(var(--filter-control-blur)) saturate(var(--material-tinted-saturation))
  }

  .video-mobile-toolbar button {
    flex: 0 0 auto;
    min-width: 0;
    min-height: 44px;
    padding: 0 var(--filter-option-padding);
    border: 0;
    border-radius: calc(var(--radius)*1.5 - 4px);
    color: inherit;
    background: transparent;
    font-size: var(--font-size-label);
    font-weight: var(--video-weight-strong);
    touch-action: manipulation;
    transition-property: color, background-color, transform;
    transition-duration: 120ms;
    transition-timing-function: ease-out
  }

  .video-mobile-toolbar button[aria-expanded=true] {
    color: var(--filter-overlay-primary-color);
    background: var(--filter-overlay-primary-background)
  }

  .video-mobile-toolbar button:active {
    transform: scale(.96)
  }

  .video-mobile-toolbar button:focus-visible,
  .video-mobile-sheet-handle:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px
  }

  .video-mobile-backdrop {
    position: fixed;
    z-index: 40;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    opacity: var(--sheet-backdrop-opacity, 1);
    background: var(--filter-overlay-backdrop-background);
    backdrop-filter: none;
    -webkit-backdrop-filter: none
  }

  .board-video-composer:not(.is-mobile-sheet-dragging) .video-mobile-backdrop {
    transition: opacity var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing)
  }

  .board-video-composer > :deep(.video-mobile-panel),
  .video-composer-right > :deep(.video-mobile-panel),
  .video-composer-right > .video-mobile-panel {
    display: none
  }

  .board-video-composer > :deep(.video-mobile-panel.is-mobile-open),
  .video-composer-right > :deep(.video-mobile-panel.is-mobile-open),
  .video-composer-right > .video-mobile-panel.is-mobile-open {
    position: fixed;
    z-index: 42;
    inset: auto 0 0;
    width: 100%;
    height: var(--video-mobile-sheet-height);
    max-height: var(--video-mobile-sheet-height);
    display: block;
    padding-bottom: 0;
    overflow: hidden;
    border-radius: calc(var(--radius-mobile)*2) calc(var(--radius-mobile)*2) 0 0;
    opacity: var(--sheet-content-opacity, 1);
    background: var(--filter-overlay-panel-background-mobile);
    backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));
    -webkit-backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));
    transform: translate3d(0, var(--video-mobile-sheet-drag-y, 0), 0);
    transition: transform var(--filter-sheet-drag-duration) var(--filter-overlay-enter-easing), opacity var(--filter-sheet-drag-duration) var(--filter-overlay-enter-easing);
    animation: video-sheet-in var(--filter-overlay-enter-duration) var(--filter-overlay-enter-easing) both
  }

  @keyframes video-sheet-in {
    from { translate: 0 2rem }
    to { translate: 0 0 }
  }

  @keyframes video-sheet-handle-in {
    from { translate: -50% 2rem }
    to { translate: -50% 0 }
  }

  .board-video-composer.is-mobile-sheet-dragging > :deep(.video-mobile-panel.is-mobile-open),
  .board-video-composer.is-mobile-sheet-dragging .video-composer-right > :deep(.video-mobile-panel.is-mobile-open),
  .board-video-composer.is-mobile-sheet-dragging .video-composer-right > .video-mobile-panel.is-mobile-open {
    transition: none;
  }

  .board-video-composer.is-mobile-sheet-dismissing > :deep(.video-mobile-panel.is-mobile-open),
  .board-video-composer.is-mobile-sheet-dismissing .video-composer-right > :deep(.video-mobile-panel.is-mobile-open),
  .board-video-composer.is-mobile-sheet-dismissing .video-composer-right > .video-mobile-panel.is-mobile-open {
    animation: none;
    transition: transform var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing), opacity var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing);
  }

  .video-composer-right {
    display: contents
  }

  .video-composer-right > :deep(.video-inspector.video-mobile-panel.is-mobile-open) {
    overflow: hidden;
    isolation: auto
  }

  .video-composer-right > :deep(.video-inspector.video-mobile-panel.is-mobile-open)::before {
    display: none
  }

  .board-video-composer > :deep(.video-inspector.video-mobile-panel.is-mobile-open > .video-panel-scroll),
  .video-composer-right > :deep(.video-inspector.video-mobile-panel.is-mobile-open > .video-panel-scroll) {
    gap: var(--video-input-gap-mobile);
    overflow-x: hidden;
    overflow-y: auto
  }

  .video-mobile-sheet-handle {
    position: fixed;
    z-index: 43;
    left: 50%;
    bottom: calc(var(--video-mobile-sheet-height) - 44px);
    width: 44px;
    height: 44px;
    min-height: 44px;
    display: block;
    padding: 0;
    border: 0;
    color: var(--filter-overlay-panel-color);
    opacity: var(--sheet-content-opacity, 1);
    background: transparent;
    translate: -50% 0;
    transform: translate3d(0, var(--video-mobile-sheet-drag-y, 0), 0);
    transition: transform var(--filter-sheet-drag-duration) var(--filter-overlay-enter-easing), opacity var(--filter-sheet-drag-duration) var(--filter-overlay-enter-easing);
    animation: video-sheet-handle-in var(--filter-overlay-enter-duration) var(--filter-overlay-enter-easing) both;
    touch-action: none
  }

  .board-video-composer.is-mobile-sheet-dragging .video-mobile-sheet-handle {
    transition: none;
  }

  .board-video-composer.is-mobile-sheet-dismissing .video-mobile-sheet-handle {
    animation: none;
    transition: transform var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing), opacity var(--filter-sheet-drag-duration) var(--filter-overlay-exit-easing);
  }

  .video-mobile-sheet-handle > span {
    position: absolute;
    top: calc(var(--space)/2);
    left: 0;
    width: 44px;
    height: 5px;
    border-radius: var(--filter-pill-radius);
    background: color-mix(in srgb, var(--filter-overlay-panel-color) 55%, transparent)
  }

  :deep(.video-timeline) {
    grid-template-columns: auto minmax(48px, 1fr);
    gap: calc(var(--space)/1);
    border-radius: var(--radius-mobile);
    background: none;
    backdrop-filter: none;
  }

  :deep(.video-timeline-play) {
    display: none
  }

  :deep(.video-stage-play) {
    position: absolute;
    z-index: 3;
    top: 50%;
    left: 50%;
    width: 56px;
    min-height: 56px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: #fff;
    background: rgb(0 0 0 / .32);
    box-shadow: 0 2px 12px rgb(0 0 0 / .22), inset 0 0 0 1px rgb(255 255 255 / .12);
    backdrop-filter: blur(16px) saturate(125%);
    -webkit-backdrop-filter: blur(16px) saturate(125%);
    translate: -50% -50%;
    transition-property: scale, background-color, opacity;
    transition-duration: 150ms;
    transition-timing-function: cubic-bezier(.2, 0, 0, 1);
    touch-action: manipulation
  }

  :deep(.video-stage-play.is-hidden) {
    opacity: 0;
    pointer-events: none
  }

  :deep(.video-stage-play:active) {
    scale: .96
  }

  :deep(.video-stage-play:focus-visible) {
    outline: 2px solid #fff;
    outline-offset: 3px
  }

  :deep(.video-stage-play-icon) {
    position: absolute;
    display: grid;
    place-items: center;
    opacity: 0;
    scale: .25;
    filter: blur(4px);
    transition-property: opacity, scale, filter;
    transition-duration: 150ms;
    transition-timing-function: cubic-bezier(.2, 0, 0, 1)
  }

  :deep(.video-stage-play-icon.active) {
    opacity: 1;
    scale: 1;
    filter: blur(0)
  }

  :deep(.video-timeline-time),
  :deep(.video-timeline-scale) {
    color: var(--color-muted)
  }

  :deep(.video-timeline-actions) {
    display: none
  }

  .video-export-button--timeline {
    display: none
  }

  :deep(.video-panel) {
    max-height: 58%
  }

  :deep(.video-template-list) {
    column-gap: var(--masonry-mobile-column-gap);
    row-gap: var(--masonry-mobile-row-gap)
  }

  :deep(.video-template-list:not(.video-template-root)) {
    grid-template-columns: repeat(3, minmax(0, 1fr))
  }

  :deep(.video-template-root) {
    margin-top: 0
  }

  :deep(.video-template-browser > .video-panel-scroll > header h2) {
    font-size: 1.75rem;
  }

  :deep(.video-template-folder h3) {
    font-size: 1.625rem;
  }

  :deep(.video-template-list strong) {
    font-size: var(--font-size-control);
  }

  :deep(.video-template-featured strong) {
    font-size: var(--font-size-body);
  }

  :deep(.video-template-list small) {
    font-size: var(--font-size-label);
  }

  :deep(.video-inspector label:has(> .video-range-input)),
  :deep(.video-inspector label:has(> .video-range-input)>span) {
    min-height: var(--range-control-height-mobile);
    
  }

  :deep(.video-choice-row:not(:has(button:nth-child(6)))) {
    height: var(--range-control-height-mobile) !important;
    min-height: var(--range-control-height-mobile) !important;
    max-height: var(--range-control-height-mobile) !important
  }

  :deep(.video-choice-row:not(:has(button:nth-child(6))) button) {
    height: calc(var(--range-control-height-mobile) - 8px) !important;
    min-height: calc(var(--range-control-height-mobile) - 8px) !important;
    max-height: calc(var(--range-control-height-mobile) - 8px) !important;
    padding-block: 0 !important
  }

  :deep(.video-choice-row:has(button:nth-child(6))) {
    gap: calc(var(--space)/2);
  }

  :deep(.video-choice-row:has(button:nth-child(6)) button) {
    min-height: var(--range-control-height-mobile);
    padding: 0 var(--filter-option-padding);
    font-size: var(--font-size-body);
  }

  :deep(.video-reset) {
    min-height: var(--range-control-height-mobile);
    font-size: var(--font-size-body);
  }

  :deep(.video-toggle) {
    width: 100%;
    min-height: var(--range-control-height-mobile);
    padding: 0 var(--filter-action-padding);
    font-size: var(--font-size-control);
  }

  :deep(.video-control-pair) {
    grid-template-columns: minmax(0, 1fr);
    row-gap: var(--video-input-gap-mobile)
  }

  :deep(.video-color-hue) {
    min-height: var(--range-control-height-mobile);
    display: grid;
    align-items: center
  }

  :deep(.video-hex-color-field) {
    height: var(--range-control-height-mobile)
  }

  :deep(.video-color-hue input[type=range]) {
    height: var(--range-control-height-mobile);
    background-size: 100% 14px;
    background-position: center;
    background-repeat: no-repeat;
    touch-action: pan-y
  }

  :deep(.video-stage) {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 0;
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none
  }

  :deep(.video-canvas-wrap) {
    border-radius: var(--radius-mobile)
  }

  .board-video-composer.is-stage-motion-ready :deep(.video-canvas-wrap) {
    transition-property: width, height;
    transition-duration: calc(var(--filter-overlay-enter-duration)/2);
    transition-timing-function: calc(var(--filter-overlay-enter-easing)/2)
  }

  .video-assets-panel li {
    grid-template-columns: 38px minmax(0, 1fr) 88px 44px;
    min-height: 52px;
    padding: var(--video-inspector-control-gap) var(--filter-option-padding);
    border-radius: calc(var(--radius)*1.5)
  }

  .video-asset-thumbnail {
    border-radius: calc(var(--radius)/2)
  }

  .video-asset-handle {
    display: none
  }

  .video-asset-mobile-order {
    display: grid;
    grid-template-columns: repeat(2, 44px)
  }

  .video-asset-mobile-order button,
  .video-asset-visibility {
    width: 44px;
    height: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    padding: 0
  }

  .video-asset-mobile-order button {
    border: 0;
    border-radius: 50%;
    color: inherit;
    background: transparent;
    font-size: 18px
  }

  .video-asset-mobile-order button:disabled {
    opacity: .28
  }

  .video-assets-show-all {
    min-height: var(--range-control-height-mobile)
  }
}

@media (max-width:1180px) and (prefers-reduced-motion: reduce) {
  .board-video-composer.is-stage-motion-ready :deep(.video-canvas-wrap) {
    transition: none
  }

  .board-video-composer > :deep(.video-mobile-panel.is-mobile-open),
  .video-composer-right > :deep(.video-mobile-panel.is-mobile-open),
  .video-composer-right > .video-mobile-panel.is-mobile-open,
  .video-mobile-sheet-handle {
    animation: none
  }
}

@media (hover: none), (pointer: coarse) {
  :deep(.video-hex-color-field) {
    height: var(--range-control-height-mobile)
  }

  :deep(.video-choice-row:not(:has(button:nth-child(6)))) {
    height: var(--range-control-height-mobile) !important;
    min-height: var(--range-control-height-mobile) !important;
    max-height: var(--range-control-height-mobile) !important
  }

  :deep(.video-choice-row:not(:has(button:nth-child(6))) button) {
    height: calc(var(--range-control-height-mobile) - 8px) !important;
    min-height: calc(var(--range-control-height-mobile) - 8px) !important;
    max-height: calc(var(--range-control-height-mobile) - 8px) !important;
    padding-block: 0 !important
  }
}
</style>
