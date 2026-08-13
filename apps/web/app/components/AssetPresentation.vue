<script setup lang="ts" generic="T extends AssetMasonryItem">
import type { AssetMasonryItem } from '../types/asset-masonry'

defineSlots<{
  details(props: { asset: T }): unknown
  previewActions(props: { asset: T }): unknown
}>()

const props = withDefaults(defineProps<{
  assets: T[]
  label?: string
  selectable?: boolean
  selectedIds?: string[]
}>(), {
  label: 'Asset presentation',
  selectable: false,
  selectedIds: () => []
})
const emit = defineEmits<{ toggleSelection: [asset: T] }>()
const index = ref(0)
const currentAsset = computed(() => props.assets[index.value])
const isSelected = computed(() => currentAsset.value ? props.selectedIds.includes(currentAsset.value.id) : false)
const move = (amount: number) => {
  if (!props.assets.length) return
  index.value = (index.value + amount + props.assets.length) % props.assets.length
}
watch(() => props.assets.map(asset => asset.id).join(','), () => {
  index.value = Math.min(index.value, Math.max(0, props.assets.length - 1))
})
</script>

<template>
  <section class="asset-presentation" :aria-label="label">
    <header>
      <span>{{ index + 1 }} / {{ assets.length }}</span>
    </header>
    <article v-if="currentAsset">
      <div class="presentation-preview">
        <AssetMedia :src="currentAsset.previewUrl"
          :srcset="currentAsset.preview2xUrl ? `${currentAsset.previewUrl} 1x, ${currentAsset.preview2xUrl} 2x` : undefined"
          :mime-type="currentAsset.mime_type" :width="currentAsset.width" :height="currentAsset.height" :alt="currentAsset.title" />
        <button v-if="assets.length > 1" type="button" class="slide-zone slide-zone-previous" aria-label="Previous item"
          @click="move(-1)" />
        <button v-if="assets.length > 1" type="button" class="slide-zone slide-zone-next" aria-label="Next item"
          @click="move(1)" />
        <div class="preview-actions">
          <slot name="previewActions" :asset="currentAsset" />
        </div>
        <button v-if="selectable" class="selection-control" type="button" :class="{ active: isSelected }"
          :aria-label="`${isSelected ? 'Deselect' : 'Select'} ${currentAsset.title}`" :aria-pressed="isSelected"
          @click="emit('toggleSelection', currentAsset)" />
      </div>
      <div class="presentation-details">
        <h3>{{ currentAsset.title }}</h3>
        <div>
          <slot name="details" :asset="currentAsset">
            <p>{{ currentAsset.description }}</p>
          </slot>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.asset-presentation {
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space)
}

.asset-presentation>header {
  color: var(--color-muted)
}

.asset-presentation>article {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 72px
}

.presentation-preview {
  position: relative;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--bg)
}

.presentation-preview :is(img,video) {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain
}

.slide-zone.slide-zone {
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: 0;
  width: 50%;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  opacity: 0;
  cursor: pointer
}

.slide-zone-previous {
  left: 0
}

.slide-zone-next {
  right: 0
}

.slide-zone:focus-visible {
  opacity: 1;
  outline: 2px solid var(--color-accent);
  outline-offset: -4px
}

.presentation-details {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-content: start;
  gap: var(--space);
  overflow: hidden;
  padding-top: 8px
}

.presentation-details h3 {
  grid-column: 1 / 3;
  margin: 0
}

.presentation-details>div {
  grid-column: 3 / 5;
  color: var(--color-muted)
}

.presentation-details :deep(p) {
  margin: 0
}

.preview-actions {
  position: absolute;
  z-index: 2;
  right: 10px;
  bottom: 10px;
  left: 10px;
  display: flex;
  justify-content: center;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity 150ms, transform 150ms cubic-bezier(.2, 0, 0, 1)
}

.presentation-preview:hover .preview-actions,
.presentation-preview:focus-within .preview-actions {
  opacity: 1;
  transform: none;
  pointer-events: auto
}

.selection-control.selection-control {
  position: absolute;
  z-index: 3;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  border: 1px solid rgb(0 0 0/.35);
  border-radius: 50%;
  background: rgb(255 255 255/.9);
  box-shadow: 0 1px 4px rgb(0 0 0/.12);
  opacity: 0;
  transition: opacity 120ms, scale 150ms, background-color 150ms, border-color 150ms
}

.selection-control.active {
  border-color: var(--color-fg);
  background: var(--color-fg);
  opacity: 1
}

.presentation-preview:hover .selection-control,
.presentation-preview:focus-within .selection-control {
  opacity: 1
}

.selection-control:active {
  scale: .9
}

@media(max-width:700px) {
  .asset-presentation>article {
    grid-template-rows: minmax(0, 1fr) 96px
  }

  .presentation-details {
    grid-template-columns: 1fr
  }

  .presentation-details h3,
  .presentation-details>div {
    grid-column: 1
  }
}

@media(hover:none) {
  .preview-actions {
    opacity: 1;
    transform: none;
    pointer-events: auto
  }

  .selection-control.selection-control {
    opacity: 1
  }
}

@media(prefers-reduced-motion:reduce) {
  .preview-actions {
    transition: none
  }
}
</style>
