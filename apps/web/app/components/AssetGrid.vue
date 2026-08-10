<script setup lang="ts" generic="T extends AssetMasonryItem">
import type { AssetMasonryItem } from '../types/asset-masonry'

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
}>(), {
  label: 'Asset grid',
  headingTag: 'h3',
  selectable: false,
  selectedIds: () => []
})

const emit = defineEmits<{ toggleSelection: [asset: T] }>()
const selectedIdSet = computed(() => new Set(props.selectedIds))
const loadedImages = reactive(new Set<string>())
</script>

<template>
  <section class="asset-grid-view" :aria-label="label">
    <article v-for="(asset, index) in assets" :key="asset.id" class="grid-card">
      <div class="grid-preview" :class="{ 'is-loading': !loadedImages.has(asset.id) }">
        <img
          :class="{ 'is-loaded': loadedImages.has(asset.id) }"
          :src="asset.previewUrl" :srcset="asset.preview2xUrl ? `${asset.previewUrl} 1x, ${asset.preview2xUrl} 2x` : undefined"
          :width="asset.width" :height="asset.height" :alt="asset.title" :loading="index < 10 ? 'eager' : 'lazy'"
          :fetchpriority="index < 2 ? 'high' : 'auto'" decoding="async" @load="loadedImages.add(asset.id)">
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
}

.grid-preview.is-loading {
  background: var(--color-surface);
}

.grid-preview img {
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

.grid-preview img.is-loaded {
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
  .asset-grid-view {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .asset-grid-view {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .asset-grid-view {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .asset-grid-view {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

@media (prefers-reduced-motion: reduce) {
  .preview-actions,
  .grid-preview img {
    transition: none;
  }
}
</style>
