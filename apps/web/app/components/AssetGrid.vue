<script setup lang="ts" generic="T extends AssetMasonryItem">
import type { AssetMasonryItem } from '../types/asset-masonry'
import type { BoardViewSettings } from '@content-library/shared'

defineSlots<{
  details(props: { asset: T }): unknown
  previewActions(props: { asset: T }): unknown
  actions(props: { asset: T }): unknown
}>()

const props = withDefaults(defineProps<{
  assets: T[]
  label?: string
  headingTag?: 'h2' | 'h3' | 'h4'
  selectable?: boolean
  selectedIds?: string[]
  viewSettings?: BoardViewSettings
}>(), {
  label: 'Asset grid',
  headingTag: 'h3',
  selectable: false,
  selectedIds: () => []
})

const emit = defineEmits<{ toggleSelection: [asset: T] }>()
const selectedIdSet = computed(() => new Set(props.selectedIds))
const loadedImages = reactive(new Set<string>())
const viewStyle = computed(() => props.viewSettings ? {
  '--board-column-offset': String(props.viewSettings.columns === 'even-fewer' ? -3 : props.viewSettings.columns === 'fewer' ? -1 : props.viewSettings.columns === 'more' ? 1 : props.viewSettings.columns === 'even-more' ? 2 : typeof props.viewSettings.columns === 'number' ? Math.max(-3, Math.min(2, props.viewSettings.columns - 6)) : 0),
  '--board-radius': { none:'0px', small:'calc(var(--radius)/2)', default:'var(--radius)', large:'var(--radius-mobile)' }[props.viewSettings.radius],
  '--board-gap': { none:'0px', tight:'calc(var(--space)/4)', default:'var(--space)', wide:'calc(var(--space)*2)' }[props.viewSettings.gap]
} : undefined)
</script>

<template>
  <section class="asset-grid-view" :class="{ 'custom-view':viewSettings, 'hide-text':viewSettings && !viewSettings.showText }" :style="viewStyle" :aria-label="label">
    <article v-for="(asset, index) in assets" :key="asset.id" class="grid-card">
      <div class="grid-preview" :class="{ 'is-loading': !loadedImages.has(asset.id) }">
        <AssetMedia
          :class="{ 'is-loaded': loadedImages.has(asset.id) }"
          :src="asset.previewUrl" :srcset="asset.preview2xUrl ? `${asset.previewUrl} 1x, ${asset.preview2xUrl} 2x` : undefined"
          :mime-type="asset.mime_type"
          :width="asset.width" :height="asset.height" :alt="asset.title" :loading="index < 10 ? 'eager' : 'lazy'"
          :fetchpriority="index < 2 ? 'high' : 'auto'" @load="loadedImages.add(asset.id)" />
        <div class="preview-actions"><slot name="previewActions" :asset="asset" /></div>
        <button
          v-if="selectable" class="selection-control" type="button" :class="{ active: selectedIdSet.has(asset.id) }"
          :aria-label="`${selectedIdSet.has(asset.id) ? 'Deselect' : 'Select'} ${asset.title}`"
          :aria-pressed="selectedIdSet.has(asset.id)" @click="emit('toggleSelection', asset)" />
      </div>
      <div class="grid-caption">
        <div><component :is="headingTag">{{ asset.title }}</component><slot name="details" :asset="asset" /></div>
        <slot name="actions" :asset="asset" />
      </div>
    </article>
  </section>
</template>

<style scoped>
.asset-grid-view {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-items: start;
  gap: var(--section-gap-compact) var(--space);
}
.asset-grid-view.custom-view{grid-template-columns:repeat(min(var(--board-columns,6),6),minmax(0,1fr));gap:var(--board-gap,var(--space))}.asset-grid-view.hide-text .grid-caption{display:none}

.grid-card {
  min-width: 0;
}

.grid-preview {
  position: relative;
  min-width: 0;
  min-height: 0;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius:var(--board-radius,0);
}

.grid-preview.is-loading {
  background: var(--color-surface);
}

.grid-preview :is(img,video) {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  display: block;
  margin: auto;
  object-fit: contain;
  opacity: 0;
  transition: opacity 150ms ease-out;
}

.grid-preview :is(img,video).is-loaded {
  opacity: 1;
}

.grid-caption {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--cluster-gap);
  padding-top: var(--cluster-gap);
  text-align: center;
}

.grid-caption > div {
  min-width: 0;
  flex: 1;
}

.grid-caption :deep(h2),
.grid-caption :deep(h3),
.grid-caption :deep(h4),
.grid-caption :deep(p) {
  margin: 0;
  overflow: hidden;
  font: inherit;
  letter-spacing: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-caption :deep(p) {
  margin-top: 4px;
  color: var(--color-muted);
}

.preview-actions {
  position: absolute;
  z-index: 2;
  right: var(--cluster-gap);
  bottom: var(--cluster-gap);
  left: var(--cluster-gap);
  display: flex;
  justify-content: center;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity 150ms ease-out, transform 150ms cubic-bezier(.2, 0, 0, 1);
}

.selection-control {
  position: absolute;
  z-index: 3;
  top: var(--cluster-gap);
  right: var(--cluster-gap);
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  border: 1px solid rgb(0 0 0 / .35);
  border-radius: 50%;
  background: rgb(255 255 255 / .9);
  opacity: 0;
}

.selection-control.active {
  border-color: var(--color-fg);
  background: var(--color-fg);
  opacity: 1;
}

.grid-card:hover .preview-actions,
.grid-card:focus-within .preview-actions {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.grid-card:hover .selection-control,
.grid-card:focus-within .selection-control {
  opacity: 1;
}

@media (max-width: 1680px) {
  .asset-grid-view,
  .asset-grid-view.custom-view {
    grid-template-columns: repeat(min(var(--board-columns, 5), 5), minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .asset-grid-view,
  .asset-grid-view.custom-view {
    grid-template-columns: repeat(min(var(--board-columns, 4), 4), minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .asset-grid-view,
  .asset-grid-view.custom-view {
    grid-template-columns: repeat(min(var(--board-columns, 3), 3), minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .asset-grid-view,
  .asset-grid-view.custom-view {
    grid-template-columns: repeat(min(var(--board-columns, 2), 2), minmax(0, 1fr));
  }
}

@media (hover: none) {
  .preview-actions,
  .selection-control {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }
}
.asset-grid-view.custom-view{grid-template-columns:repeat(clamp(1,calc(6 + var(--board-column-offset,0)),8),minmax(0,1fr))}
@media(max-width:1680px){.asset-grid-view.custom-view{grid-template-columns:repeat(clamp(1,calc(5 + var(--board-column-offset,0)),7),minmax(0,1fr))}}
@media(max-width:1280px){.asset-grid-view.custom-view{grid-template-columns:repeat(clamp(1,calc(4 + var(--board-column-offset,0)),6),minmax(0,1fr))}}
@media(max-width:900px){.asset-grid-view.custom-view{grid-template-columns:repeat(clamp(1,calc(3 + var(--board-column-offset,0)),5),minmax(0,1fr))}}
@media(max-width:600px){.asset-grid-view.custom-view{grid-template-columns:repeat(clamp(1,calc(2 + var(--board-column-offset,0)),4),minmax(0,1fr))}}
@media (prefers-reduced-motion: reduce) {
  .preview-actions,
  .grid-preview :is(img,video) {
    transition: none;
  }
}
</style>
