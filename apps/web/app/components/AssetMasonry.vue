<script setup lang="ts" generic="T extends AssetMasonryItem">
import type { RouteLocationRaw } from 'vue-router'
import { Heart } from 'reicon-vue'
import type { BoardViewSettings } from '@content-library/shared'
import type { AssetMasonryItem } from '../types/asset-masonry'

defineSlots<{
  details(props: { asset: T }): unknown
  previewActions(props: { asset: T }): unknown
  actions(props: { asset: T }): unknown
}>()

const props = withDefaults(defineProps<{
  assets: T[]
  interactive?: boolean
  hidden?: boolean
  label?: string
  headingTag?: 'h2' | 'h3' | 'h4'
  layout?: 'masonry' | 'column'
  selectable?: boolean
  selectedIds?: string[]
  reorderable?: boolean
  rowFlow?: boolean
  stableColumns?: boolean
  animateChanges?: boolean
  canApprove?: boolean
  viewSettings?: BoardViewSettings
}>(), {
  interactive: false,
  hidden: false,
  label: 'Assets',
  headingTag: 'h2',
  layout: 'masonry',
  selectable: false,
  selectedIds: () => [],
  reorderable: false,
  rowFlow: false,
  stableColumns: false,
  animateChanges: false,
  canApprove: false
})
const emit = defineEmits<{
  toggleSelection: [asset: T]
  reorder: [fromIndex: number, toIndex: number]
  toggleApproval: [asset: T]
}>()
const inheritedViewSettings = inject<Ref<BoardViewSettings> | undefined>('boardViewSettings', undefined)
const effectiveViewSettings = computed(() => props.viewSettings ?? inheritedViewSettings?.value)

const route = useRoute()
const router = useRouter()
const loadedImages = reactive(new Set<string>())
const selectedIdSet = computed(() => new Set(props.selectedIds))
const isSelected = (id: string) => selectedIdSet.value.has(id)
const masonry = ref<HTMLElement | null>(null)
const layoutReady = ref(false)
const renderedAssets = shallowRef<T[]>([...props.assets])
const draggedId = ref<string | null>(null)
const draggedOriginalIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)
let resizeObserver: ResizeObserver | undefined
let measureFrame = 0
let revealFrame = 0
let touchPointerId: number | undefined
let activeViewTransition: { finished: Promise<void>; skipTransition?: () => void } | undefined
const assetLink = (id: string): RouteLocationRaw => ({ path: '/library', query: { ...route.query, asset: id } })
const openAsset = (event: MouseEvent, id: string) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const transitionDocument = document as Document & { startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void>; skipTransition?: () => void } }
  if (!transitionDocument.startViewTransition || !window.matchMedia('(max-width: 760px)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  event.preventDefault()
  const image = (event.currentTarget as HTMLElement).querySelector<HTMLImageElement>('img')
  if (!image) return void router.push(assetLink(id))
  image.style.viewTransitionName = 'asset-preview'
  try {
    activeViewTransition?.skipTransition?.()
    const transition = transitionDocument.startViewTransition(async () => {
      await router.push(assetLink(id))
      image.style.viewTransitionName = ''
      await nextTick()
    })
    activeViewTransition = transition
    transition.finished.catch(() => undefined).finally(() => {
      image.style.viewTransitionName = ''
      if (activeViewTransition === transition) activeViewTransition = undefined
    })
  } catch {
    image.style.viewTransitionName = ''
    activeViewTransition = undefined
    void router.push(assetLink(id))
  }
}
const cardStagger = (index: number) => `${Math.min(index * 18, 144)}ms`
const startDrag = (event: DragEvent, index: number) => {
  if (!props.reorderable || !event.dataTransfer) return
  const asset = renderedAssets.value[index]
  if (!asset) return
  draggedId.value = asset.id
  draggedOriginalIndex.value = props.assets.findIndex(item => item.id === asset.id)
  dropIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', asset.id)
}
const dragOver = (event: DragEvent, index: number) => {
  if (!draggedId.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const fromIndex = renderedAssets.value.findIndex(asset => asset.id === draggedId.value)
  if (fromIndex < 0 || fromIndex === index) return
  const next = [...renderedAssets.value]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return
  next.splice(index, 0, moved)
  renderedAssets.value = next
  dropIndex.value = index
  nextTick(measureCards)
}
const finishDrag = (restore = true) => {
  if (restore) renderedAssets.value = [...props.assets]
  draggedId.value = null
  draggedOriginalIndex.value = null
  dropIndex.value = null
}
const commitReorder = () => {
  if (!draggedId.value || draggedOriginalIndex.value === null) return
  const fromIndex = draggedOriginalIndex.value
  const toIndex = renderedAssets.value.findIndex(asset => asset.id === draggedId.value)
  finishDrag(false)
  if (toIndex >= 0 && fromIndex !== toIndex) emit('reorder', fromIndex, toIndex)
}
const dropAsset = (event: DragEvent) => {
  event.preventDefault()
  commitReorder()
}
const startTouchDrag = (event: PointerEvent, index: number) => {
  if (!props.reorderable || event.pointerType === 'mouse') return
  event.preventDefault()
  touchPointerId = event.pointerId
  draggedId.value = renderedAssets.value[index]?.id ?? null
  if (!draggedId.value) return
  draggedOriginalIndex.value = props.assets.findIndex(item => item.id === draggedId.value)
  dropIndex.value = index
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
const moveTouchDrag = (event: PointerEvent) => {
  if (event.pointerId !== touchPointerId || !draggedId.value) return
  event.preventDefault()
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.asset-card[data-asset-id]')
  if (!target || !masonry.value?.contains(target)) return
  const targetIndex = renderedAssets.value.findIndex(asset => asset.id === target.dataset.assetId)
  if (targetIndex >= 0) dragOver(event as unknown as DragEvent, targetIndex)
}
const finishTouchDrag = (event: PointerEvent) => {
  if (event.pointerId !== touchPointerId) return
  touchPointerId = undefined
  commitReorder()
}
const cancelTouchDrag = (event: PointerEvent) => {
  if (event.pointerId !== touchPointerId) return
  touchPointerId = undefined
  finishDrag()
}
const measureCards = () => {
  cancelAnimationFrame(measureFrame)
  cancelAnimationFrame(revealFrame)
  measureFrame = requestAnimationFrame(() => {
    const root = masonry.value
    if (!root) return
    if (props.rowFlow) {
      root.classList.remove('is-masonry')
      revealFrame = requestAnimationFrame(() => { layoutReady.value = true })
      return
    }
    const styles = getComputedStyle(root)
    const rowHeight = Number.parseFloat(styles.gridAutoRows) || 1
    const rowGap = Number.parseFloat(styles.rowGap) || 0
    for (const card of root.querySelectorAll<HTMLElement>('.asset-card')) {
      const rows = String(Math.ceil((card.getBoundingClientRect().height + rowGap) / (rowHeight + rowGap)))
      if (card.style.getPropertyValue('--card-rows') !== rows) card.style.setProperty('--card-rows', rows)
    }
    root.classList.add('is-masonry')
    revealFrame = requestAnimationFrame(() => { layoutReady.value = true })
  })
}
const syncLoadedImages = () => {
  const root = masonry.value
  if (!root) return
  let changed = false
  for (const image of root.querySelectorAll<HTMLImageElement>('.preview img[data-asset-id]')) {
    const id = image.dataset.assetId
    if (id && image.complete && image.naturalWidth > 0 && !loadedImages.has(id)) {
      loadedImages.add(id)
      changed = true
    }
  }
  if (changed) nextTick(measureCards)
}
const observeCards = () => {
  resizeObserver?.disconnect()
  if (!masonry.value) return
  resizeObserver = new ResizeObserver(measureCards)
  resizeObserver.observe(masonry.value)
  for (const card of masonry.value.querySelectorAll('.asset-card')) resizeObserver.observe(card)
  syncLoadedImages()
  measureCards()
}
const markImageLoaded = (id: string) => {
  loadedImages.add(id)
  nextTick(measureCards)
}
const projectAndTags = (asset: AssetMasonryItem) => {
  const tags = (asset.asset_tags ?? []).slice(0, 2).map(link => link.tags?.name).filter(Boolean)
  return `${asset.projects?.name ?? 'No project'}${tags.length ? ` · ${tags.join(', ')}` : ''}`
}
const viewStyle = computed(() => {
  const view = effectiveViewSettings.value
  if (!view) return undefined
  const radius = { none:'0px', small:'calc(var(--radius)/2)', default:'var(--radius)', large:'var(--radius-mobile)' }[view.radius]
  const gap = { none:'0px', tight:'calc(var(--space)/4)', default:'var(--board-default-gap,var(--space))', wide:'calc(var(--space)*2)' }[view.gap]
  const density = view.columns === 'even-fewer' ? -3 : view.columns === 'fewer' ? -1 : view.columns === 'more' ? 1 : view.columns === 'even-more' ? 2 : typeof view.columns === 'number' ? Math.max(-3, Math.min(2, view.columns - 7)) : 0
  return { '--board-column-offset': String(density), '--board-radius':radius, '--board-gap':gap }
})
watch(() => [props.assets.map(asset => asset.id).join(','), props.rowFlow], async () => {
  if (!draggedId.value) renderedAssets.value = [...props.assets]
  await nextTick()
  observeCards()
})
onMounted(() => {
  observeCards()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(measureFrame)
  cancelAnimationFrame(revealFrame)
  activeViewTransition?.skipTransition?.()
  resizeObserver?.disconnect()
})
</script>

<template>
  <section ref="masonry" class="asset-masonry" :class="{ 'cards-hidden': hidden || !layoutReady, 'column-layout': layout === 'column', 'stable-columns': stableColumns, 'custom-view': effectiveViewSettings, 'hide-text': effectiveViewSettings && !effectiveViewSettings.showText }" :style="viewStyle" :aria-label="label">
    <TransitionGroup name="card-list" :css="animateChanges">
    <article v-for="(asset, index) in renderedAssets" :key="asset.id" class="asset-card" :class="{ 'is-priority': index < 7, 'is-selected': isSelected(asset.id), 'is-dragging': draggedId === asset.id, 'is-drop-target': dropIndex === index && draggedId !== asset.id }" :style="{ '--card-stagger': cardStagger(index) }" :data-asset-id="asset.id" :draggable="reorderable" @dragstart="startDrag($event, index)" @dragover="dragOver($event, index)" @drop="dropAsset" @dragend="finishDrag()">
      <div class="preview" :class="{ 'is-loading': !loadedImages.has(asset.id) }" :style="{ aspectRatio: `${asset.width} / ${asset.height}` }">
        <NuxtLink v-if="interactive" class="preview-link" :to="assetLink(asset.id)" :aria-label="`View ${asset.title}`" @click="openAsset($event, asset.id)">
          <img :class="{ 'is-loaded': loadedImages.has(asset.id) }" :data-asset-id="asset.id" :src="asset.previewUrl" :srcset="asset.preview2xUrl ? `${asset.previewUrl} 1x, ${asset.preview2xUrl} 2x` : undefined" :width="asset.width" :height="asset.height" :alt="`Preview of ${asset.title}`" :loading="index < 7 ? 'eager' : 'lazy'" :fetchpriority="index < 7 ? 'high' : 'auto'" decoding="async" @load="markImageLoaded(asset.id)">
        </NuxtLink>
        <img v-else :class="{ 'is-loaded': loadedImages.has(asset.id) }" :data-asset-id="asset.id" :src="asset.previewUrl" :srcset="asset.preview2xUrl ? `${asset.previewUrl} 1x, ${asset.preview2xUrl} 2x` : undefined" :width="asset.width" :height="asset.height" :alt="asset.title" :loading="index < 7 ? 'eager' : 'lazy'" :fetchpriority="index < 7 ? 'high' : 'auto'" decoding="async" @load="markImageLoaded(asset.id)">
        <div v-if="interactive && (asset.figma_url || canApprove)" class="card-quick-actions"><a v-if="asset.figma_url" class="figma-button" :href="asset.figma_url" target="_blank" rel="noopener noreferrer">Open in Figma</a><button v-if="canApprove" class="card-approval-toggle" type="button" :aria-pressed="asset.status === 'approved'" :aria-label="asset.status === 'approved' ? `Remove approval from ${asset.title}` : `Approve ${asset.title}`" :title="asset.status === 'approved' ? 'Remove approval' : 'Approve'" @click.stop="emit('toggleApproval', asset)"><Heart :size="16" :weight="asset.status === 'approved' ? 'Filled' : 'Outline'" aria-hidden="true" /></button></div>
        <div class="preview-actions"><slot name="previewActions" :asset="asset" /></div>
        <button v-if="selectable" class="selection-control" type="button" :class="{ active: isSelected(asset.id) }" :aria-label="`${isSelected(asset.id) ? 'Deselect' : 'Select'} ${asset.title}`" :aria-pressed="isSelected(asset.id)" @click="emit('toggleSelection', asset)" />
        <button
          v-if="reorderable" class="touch-reorder-handle" type="button" :aria-label="`Drag to reorder ${asset.title}`"
          @pointerdown.stop="startTouchDrag($event, index)" @pointermove.stop="moveTouchDrag" @pointerup.stop="finishTouchDrag"
          @pointercancel.stop="cancelTouchDrag" @click.prevent>
          <span aria-hidden="true">⠿</span>
        </button>
      </div>
      <div class="card-body">
        <div>
          <component :is="headingTag" class="card-title"><NuxtLink v-if="interactive" :to="assetLink(asset.id)">{{ asset.title }}</NuxtLink><template v-else>{{ asset.title }}</template></component>
          <slot name="details" :asset="asset"><p v-if="interactive">{{ projectAndTags(asset) }}</p><p v-else-if="asset.description">{{ asset.description }}</p></slot>
        </div>
        <slot name="actions" :asset="asset"><span v-if="interactive" class="card-meta card-status">{{ asset.status }}</span></slot>
      </div>
    </article>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.asset-masonry{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));column-gap:var(--space);align-items:start}.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(min(var(--board-columns,7),7),minmax(0,1fr));column-gap:var(--board-gap,var(--space))}.asset-masonry.is-masonry{grid-auto-flow:dense;grid-auto-rows:1px;row-gap:0}
.asset-masonry.stable-columns .asset-card:nth-child(7n + 1){grid-column:1}.asset-masonry.stable-columns .asset-card:nth-child(7n + 2){grid-column:2}.asset-masonry.stable-columns .asset-card:nth-child(7n + 3){grid-column:3}.asset-masonry.stable-columns .asset-card:nth-child(7n + 4){grid-column:4}.asset-masonry.stable-columns .asset-card:nth-child(7n + 5){grid-column:5}.asset-masonry.stable-columns .asset-card:nth-child(7n + 6){grid-column:6}.asset-masonry.stable-columns .asset-card:nth-child(7n){grid-column:7}
.asset-masonry.column-layout{--column-viewport-margin:clamp(24px,6vh,64px);width:min(760px,100%);margin-inline:auto;grid-template-columns:minmax(0,1fr);row-gap:0}.asset-masonry.column-layout .asset-card{padding-bottom:var(--section-gap)}.asset-masonry.column-layout .preview{height:auto;aspect-ratio:auto!important;overflow:visible;clip-path:none;background:transparent}.asset-masonry.column-layout .preview img{width:auto;height:auto;max-width:100%;max-height:calc(100vh - var(--column-viewport-margin)*2);max-height:calc(100dvh - var(--column-viewport-margin)*2);margin-inline:auto;border-radius:var(--radius);object-fit:contain}.asset-masonry.column-layout .card-body{flex-direction:column;align-items:center;justify-content:center;text-align:center}
.asset-card{position:relative;min-width:0;padding-bottom:calc(var(--space)*2);color:inherit;background:transparent;opacity:1;transform:translateY(0);transition-property:opacity,transform;transition-duration:.18s,.22s;transition-delay:var(--card-stagger,0ms);transition-timing-function:ease-out,cubic-bezier(.2,0,0,1)}.asset-masonry.is-masonry .asset-card{grid-row-end:span var(--card-rows)}
.asset-card[draggable=true]{cursor:grab}.asset-card[draggable=true]:active{cursor:grabbing}.asset-card.is-dragging{opacity:.35}.asset-card.is-drop-target .preview{box-shadow:0 0 0 3px var(--color-accent)}
.preview{position:relative;overflow:hidden;border-radius:var(--board-radius,var(--radius));background:transparent;clip-path:inset(0 round var(--board-radius,var(--radius)))}.preview.is-loading{background:var(--color-surface)}
.asset-masonry.custom-view .card-status{display:none}.asset-masonry.hide-text .card-body{display:none}.asset-masonry.custom-view .asset-card{padding-bottom:var(--board-gap,var(--space))}
.preview-link{display:block;width:100%;height:100%}.preview-link:hover,.card-body a:hover{opacity:1}
.preview img{display:block;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .12s ease-out}.preview img.is-loaded{opacity:1}
.asset-card.is-priority .preview img{transition:none}
.card-body{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space);padding-top:8px}.card-body .card-title,.card-body :deep(p){margin:0;font:inherit;letter-spacing:inherit}.card-body a{text-decoration:none}.card-body :deep(p),.card-meta{opacity:.3}.card-meta{white-space:nowrap}.card-status{text-transform:capitalize}
.card-quick-actions{position:absolute;z-index:2;left:50%;bottom:10px;display:flex;align-items:center;gap:calc(var(--space)/4);visibility:hidden;transform:translate(-50%,8px) scale(.96);pointer-events:none;transition:transform 150ms cubic-bezier(.2,0,0,1);transition-behavior:allow-discrete}
.figma-button,.card-approval-toggle{min-height:32px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:999px;color:var(--material-tinted-fg);background:var(--material-tinted-bg);font-size:12px;text-decoration:none;white-space:nowrap;box-shadow:none;-webkit-backdrop-filter:blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));backdrop-filter:blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));transition:scale 150ms,background-color 150ms cubic-bezier(.2,0,0,1)}
.figma-button{padding:0 13px}.card-approval-toggle{width:32px;min-width:32px;padding:0}
.preview-actions{position:absolute;z-index:3;right:10px;bottom:10px;left:10px;display:flex;justify-content:center;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity 150ms,transform 150ms cubic-bezier(.2,0,0,1)}
.selection-control.selection-control{position:absolute;z-index:3;top:10px;right:10px;width:24px;height:24px;min-height:24px;padding:0;border:1px solid rgb(0 0 0/.35);border-radius:50%;background:rgb(255 255 255/.9);box-shadow:0 1px 4px rgb(0 0 0/.12);opacity:0;transition:opacity 120ms,scale 150ms,background-color 150ms,border-color 150ms}.selection-control.active{border-color:var(--color-fg);background:var(--color-fg);opacity:1}.selection-control:hover{border-color:var(--color-fg)}.selection-control:active{scale:.9}
.touch-reorder-handle{position:absolute;z-index:4;top:10px;right:10px;width:36px;height:36px;min-height:36px;display:none;place-items:center;padding:0;border-radius:50%;color:var(--material-tinted-fg);background:var(--material-tinted-bg);font-size:23px;line-height:1;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-backdrop-filter:blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));backdrop-filter:blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation))}.touch-reorder-handle span{translate:0 -1px;pointer-events:none}
.figma-button:is(:hover,:focus-visible),.card-approval-toggle:is(:hover,:focus-visible){opacity:1;background:var(--material-tinted-hover-bg);-webkit-backdrop-filter:blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));backdrop-filter:blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation))}.figma-button:active,.card-approval-toggle:active{scale:.96}.figma-button:focus-visible,.card-approval-toggle:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
@media(hover:hover) and (pointer:fine){.asset-card:hover .selection-control,.asset-card:focus-within .selection-control{opacity:1}.asset-card:hover .card-quick-actions,.asset-card:focus-within .card-quick-actions{visibility:visible;transform:translate(-50%,0) scale(1);pointer-events:auto}.asset-card:hover .preview-actions,.asset-card:focus-within .preview-actions{opacity:1;transform:translateY(0);pointer-events:auto}}
.asset-masonry.cards-hidden .asset-card{opacity:0;transform:translateY(16px);transition-delay:var(--card-stagger,0ms)}
.card-list-enter-active,.card-list-leave-active{transition-property:opacity,transform;transition-duration:.18s,.22s;transition-delay:0ms;transition-timing-function:ease-out,cubic-bezier(.2,0,0,1)}.card-list-enter-active{animation:none}.card-list-enter-from{opacity:0;transform:translateY(12px)}.card-list-leave-to{opacity:0;transform:translateY(-4px)}
.card-list-move{transition:transform .2s cubic-bezier(.2,0,0,1)}
@media(max-width:2200px){.asset-masonry,.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(min(var(--board-columns,6),6),minmax(0,1fr))}.asset-masonry.stable-columns .asset-card:nth-child(n){grid-column:auto}.asset-masonry.stable-columns .asset-card:nth-child(6n + 1){grid-column:1}.asset-masonry.stable-columns .asset-card:nth-child(6n + 2){grid-column:2}.asset-masonry.stable-columns .asset-card:nth-child(6n + 3){grid-column:3}.asset-masonry.stable-columns .asset-card:nth-child(6n + 4){grid-column:4}.asset-masonry.stable-columns .asset-card:nth-child(6n + 5){grid-column:5}.asset-masonry.stable-columns .asset-card:nth-child(6n){grid-column:6}}
@media(max-width:1680px){.asset-masonry,.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(min(var(--board-columns,5),5),minmax(0,1fr))}.asset-masonry.stable-columns .asset-card:nth-child(n){grid-column:auto}.asset-masonry.stable-columns .asset-card:nth-child(5n + 1){grid-column:1}.asset-masonry.stable-columns .asset-card:nth-child(5n + 2){grid-column:2}.asset-masonry.stable-columns .asset-card:nth-child(5n + 3){grid-column:3}.asset-masonry.stable-columns .asset-card:nth-child(5n + 4){grid-column:4}.asset-masonry.stable-columns .asset-card:nth-child(5n){grid-column:5}}
@media(max-width:1280px){.asset-masonry,.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(min(var(--board-columns,4),4),minmax(0,1fr))}.asset-masonry.stable-columns .asset-card:nth-child(n){grid-column:auto}.asset-masonry.stable-columns .asset-card:nth-child(4n + 1){grid-column:1}.asset-masonry.stable-columns .asset-card:nth-child(4n + 2){grid-column:2}.asset-masonry.stable-columns .asset-card:nth-child(4n + 3){grid-column:3}.asset-masonry.stable-columns .asset-card:nth-child(4n){grid-column:4}}
@media(max-width:900px){.asset-masonry,.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(min(var(--board-columns,3),3),minmax(0,1fr))}.asset-masonry.stable-columns .asset-card:nth-child(n){grid-column:auto}.asset-masonry.stable-columns .asset-card:nth-child(3n + 1){grid-column:1}.asset-masonry.stable-columns .asset-card:nth-child(3n + 2){grid-column:2}.asset-masonry.stable-columns .asset-card:nth-child(3n){grid-column:3}}
@media(max-width:520px){.asset-masonry{--board-default-gap:calc(var(--space)/2);width:calc(100% + var(--space));margin-inline:calc(var(--space)/-2);grid-template-columns:repeat(2,minmax(0,1fr));column-gap:calc(var(--space)/2)}.asset-masonry,.asset-masonry.is-masonry{row-gap:calc(var(--space)/3)}.asset-masonry.custom-view,.asset-masonry.custom-view.is-masonry{row-gap:0}.asset-card{padding-bottom:0}.preview{border-radius:var(--radius-mobile);clip-path:inset(0 round var(--radius-mobile))}.asset-masonry.stable-columns .asset-card:nth-child(n){grid-column:auto}.asset-masonry.stable-columns .asset-card:nth-child(odd){grid-column:1}.asset-masonry.stable-columns .asset-card:nth-child(even){grid-column:2}.card-body{padding-top:calc(var(--space)/3);padding-left:calc(var(--space)/4);font-size:14px}}
.asset-masonry.custom-view .preview{border-radius:var(--board-radius,var(--radius));clip-path:inset(0 round var(--board-radius,var(--radius)))}
@media(max-width:520px){.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(min(var(--board-columns,2),2),minmax(0,1fr));column-gap:var(--board-gap,var(--space))}}
.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(clamp(1,calc(7 + var(--board-column-offset,0)),9),minmax(0,1fr))}
@media(max-width:2200px){.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(clamp(1,calc(6 + var(--board-column-offset,0)),8),minmax(0,1fr))}}
@media(max-width:1680px){.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(clamp(1,calc(5 + var(--board-column-offset,0)),7),minmax(0,1fr))}}
@media(max-width:1280px){.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(clamp(1,calc(4 + var(--board-column-offset,0)),6),minmax(0,1fr))}}
@media(max-width:900px){.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(clamp(1,calc(3 + var(--board-column-offset,0)),5),minmax(0,1fr))}}
@media(max-width:520px){.asset-masonry.custom-view:not(.column-layout){grid-template-columns:repeat(clamp(1,calc(2 + var(--board-column-offset,0)),4),minmax(0,1fr))}}
@media(hover:none),(pointer:coarse){.selection-control.selection-control{opacity:1}.card-quick-actions{display:none}.preview-actions{opacity:1;transform:none;pointer-events:auto}.touch-reorder-handle{display:grid}.preview-link,.preview-link:hover,.preview-link:active,.preview-link:focus{opacity:1}.preview img{filter:none}}
@media(prefers-reduced-motion:reduce){.asset-card,.card-list-enter-active,.card-list-leave-active{transition:none;animation:none}.asset-masonry.cards-hidden .asset-card{opacity:1;transform:none}.preview img{transition:none}.figma-button{transition-duration:.01ms;transform:translate(-50%,0)}.preview-actions{transition:none}.figma-button:active{scale:1}}
</style>
