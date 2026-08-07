<script setup lang="ts" generic="T extends AssetMasonryItem">
import type { RouteLocationRaw } from 'vue-router'
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
}>(), {
  interactive: false,
  hidden: false,
  label: 'Assets',
  headingTag: 'h2',
  layout: 'masonry',
  selectable: false,
  selectedIds: () => []
})
const emit = defineEmits<{ toggleSelection: [asset: T] }>()

const loadedImages = reactive(new Set<string>())
const selectedIdSet = computed(() => new Set(props.selectedIds))
const isSelected = (id: string) => selectedIdSet.value.has(id)
const masonry = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | undefined
let measureFrame = 0
const assetLink = (id: string): RouteLocationRaw => ({ path: '/library', query: { asset: id } })
const cardStagger = (index: number) => `${Math.min(index * 18, 144)}ms`
const measureCards = () => {
  cancelAnimationFrame(measureFrame)
  measureFrame = requestAnimationFrame(() => {
    const root = masonry.value
    if (!root) return
    for (const card of root.querySelectorAll<HTMLElement>('.asset-card')) {
      const rows = String(Math.ceil(card.getBoundingClientRect().height))
      if (card.style.getPropertyValue('--card-rows') !== rows) card.style.setProperty('--card-rows', rows)
    }
    root.classList.add('is-masonry')
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
watch(() => props.assets.map(asset => asset.id).join(','), async () => {
  await nextTick()
  observeCards()
})
onMounted(observeCards)
onBeforeUnmount(() => {
  cancelAnimationFrame(measureFrame)
  resizeObserver?.disconnect()
})
</script>

<template>
  <section ref="masonry" class="asset-masonry" :class="{ 'cards-hidden': hidden, 'column-layout': layout === 'column' }" :aria-label="label">
    <article v-for="(asset, index) in assets" :key="asset.id" class="asset-card" :class="{ 'is-selected': isSelected(asset.id) }" :style="{ '--card-stagger': cardStagger(index) }">
      <div class="preview" :class="{ 'is-loading': !loadedImages.has(asset.id) }" :style="{ aspectRatio: `${asset.width} / ${asset.height}` }">
        <NuxtLink v-if="interactive" class="preview-link" :to="assetLink(asset.id)" :aria-label="`View ${asset.title}`">
          <img :class="{ 'is-loaded': loadedImages.has(asset.id) }" :data-asset-id="asset.id" :src="asset.previewUrl" :srcset="asset.preview2xUrl ? `${asset.previewUrl} 1x, ${asset.preview2xUrl} 2x` : undefined" :width="asset.width" :height="asset.height" :alt="`Preview of ${asset.title}`" :loading="index < 6 ? 'eager' : 'lazy'" :fetchpriority="index < 2 ? 'high' : 'auto'" decoding="async" @load="markImageLoaded(asset.id)">
        </NuxtLink>
        <img v-else :class="{ 'is-loaded': loadedImages.has(asset.id) }" :data-asset-id="asset.id" :src="asset.previewUrl" :srcset="asset.preview2xUrl ? `${asset.previewUrl} 1x, ${asset.preview2xUrl} 2x` : undefined" :width="asset.width" :height="asset.height" :alt="asset.title" :loading="index < 6 ? 'eager' : 'lazy'" :fetchpriority="index < 2 ? 'high' : 'auto'" decoding="async" @load="markImageLoaded(asset.id)">
        <a v-if="interactive && asset.figma_url" class="figma-button" :href="asset.figma_url" target="_blank" rel="noopener noreferrer">Open in Figma</a>
        <div class="preview-actions"><slot name="previewActions" :asset="asset" /></div>
        <button v-if="selectable" class="selection-control" type="button" :class="{ active: isSelected(asset.id) }" :aria-label="`${isSelected(asset.id) ? 'Deselect' : 'Select'} ${asset.title}`" :aria-pressed="isSelected(asset.id)" @click="emit('toggleSelection', asset)" />
      </div>
      <div class="card-body">
        <div>
          <component :is="headingTag" class="card-title"><NuxtLink v-if="interactive" :to="assetLink(asset.id)">{{ asset.title }}</NuxtLink><template v-else>{{ asset.title }}</template></component>
          <slot name="details" :asset="asset"><p v-if="interactive">{{ projectAndTags(asset) }}</p><p v-else-if="asset.description">{{ asset.description }}</p></slot>
        </div>
        <slot name="actions" :asset="asset"><span v-if="interactive" class="card-meta card-status">{{ asset.status }}</span></slot>
      </div>
    </article>
  </section>
</template>

<style scoped>
.asset-masonry{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));column-gap:var(--space);align-items:start}.asset-masonry.is-masonry{grid-auto-rows:1px;row-gap:0}
.asset-masonry.column-layout{--column-viewport-margin:clamp(24px,6vh,64px);width:min(760px,100%);margin-inline:auto;grid-template-columns:minmax(0,1fr);row-gap:0}.asset-masonry.column-layout .asset-card{padding-bottom:var(--section-gap)}.asset-masonry.column-layout .preview{height:auto;aspect-ratio:auto!important;overflow:visible;clip-path:none;background:transparent}.asset-masonry.column-layout .preview img{width:auto;height:auto;max-width:100%;max-height:calc(100vh - var(--column-viewport-margin)*2);max-height:calc(100dvh - var(--column-viewport-margin)*2);margin-inline:auto;border-radius:var(--radius);object-fit:contain}
.asset-card{min-width:0;padding-bottom:calc(var(--space)*2);color:inherit;background:transparent;opacity:1;transform:translateY(0);transition-property:opacity,transform;transition-duration:.18s,.22s;transition-delay:var(--card-stagger,0ms);transition-timing-function:ease-out,cubic-bezier(.16,1.35,.3,1);animation:card-fade-in .42s cubic-bezier(.16,1.35,.3,1) backwards;animation-delay:var(--card-stagger,0ms)}.asset-masonry.is-masonry .asset-card{grid-row-end:span var(--card-rows)}
.preview{position:relative;overflow:hidden;border-radius:var(--radius);background:transparent;clip-path:inset(0 round var(--radius))}.preview.is-loading{background:var(--color-surface)}
.preview-link{display:block;width:100%;height:100%}.preview-link:hover,.card-body a:hover{opacity:1}
.preview img{display:block;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .12s ease-out}.preview img.is-loaded{opacity:1}
.card-body{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space);padding-top:8px}.card-body .card-title,.card-body p{margin:0;font:inherit;letter-spacing:inherit}.card-body a{text-decoration:none}.card-body p,.card-meta{opacity:.3}.card-meta{white-space:nowrap}.card-status{text-transform:capitalize}
.figma-button{position:absolute;z-index:2;left:50%;bottom:10px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0 13px;border-radius:999px;color:#000;background:#fff;font-size:12px;text-decoration:none;white-space:nowrap;box-shadow:0 1px 3px rgb(0 0 0/.12);opacity:0;transform:translate(-50%,8px);pointer-events:none;transition-property:opacity,transform,scale;transition-duration:150ms;transition-timing-function:cubic-bezier(.2,0,0,1)}
.preview-actions{position:absolute;z-index:3;right:10px;bottom:10px;left:10px;display:flex;justify-content:center;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity 150ms,transform 150ms cubic-bezier(.2,0,0,1)}
.selection-control.selection-control{position:absolute;z-index:3;top:10px;right:10px;width:24px;height:24px;min-height:24px;padding:0;border:1px solid rgb(0 0 0/.35);border-radius:50%;background:rgb(255 255 255/.9);box-shadow:0 1px 4px rgb(0 0 0/.12);opacity:0;transition:opacity 120ms,scale 150ms,background-color 150ms,border-color 150ms}.selection-control.active{border-color:var(--color-fg);background:var(--color-fg);opacity:1}.selection-control:hover{border-color:var(--color-fg)}.selection-control:active{scale:.9}.asset-card:hover .selection-control,.asset-card:focus-within .selection-control{opacity:1}
.asset-card:hover .figma-button,.asset-card:focus-within .figma-button{opacity:1;transform:translate(-50%,0);pointer-events:auto}.asset-card:hover .preview-actions,.asset-card:focus-within .preview-actions{opacity:1;transform:translateY(0);pointer-events:auto}.figma-button:hover{opacity:.8}.figma-button:active{scale:.96}.figma-button:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.asset-masonry.cards-hidden .asset-card{opacity:0;transform:translateY(16px);transition-delay:0ms}
@keyframes card-fade-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:2200px){.asset-masonry{grid-template-columns:repeat(5,minmax(0,1fr))}}
@media(max-width:1680px){.asset-masonry{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1280px){.asset-masonry{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:900px){.asset-masonry{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.asset-masonry{grid-template-columns:minmax(0,1fr)}.card-body{font-size:14px}}
@media(hover:none){.selection-control.selection-control{opacity:1}.preview-actions{opacity:1;transform:none;pointer-events:auto}}
@media(prefers-reduced-motion:reduce){.asset-card{transition:none;animation:none}.asset-masonry.cards-hidden .asset-card{opacity:1;transform:none}.preview img{transition:none}.figma-button{transition-duration:.01ms;transform:translate(-50%,0)}.preview-actions{transition:none}.figma-button:active{scale:1}}
</style>
