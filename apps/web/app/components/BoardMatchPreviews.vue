<script setup lang="ts">
defineProps<{
  assets: Array<{
    id: string
    title: string
    previewUrl: string
    mime_type?: string | null
    width: number
    height: number
  }>
  loading?: boolean
}>()
</script>

<template>
  <div class="board-match-previews" :class="{ 'is-empty': !loading && !assets.length }" role="region" aria-label="Matching asset previews" :aria-busy="loading" :tabindex="assets.length ? 0 : -1">
    <span v-for="asset in assets" :key="asset.id" class="board-match-preview">
      <AssetMedia :src="asset.previewUrl" :mime-type="asset.mime_type ?? ''" :width="asset.width" :height="asset.height" :alt="asset.title" loading="lazy" />
    </span>
    <template v-if="loading && !assets.length">
      <span v-for="index in 5" :key="`placeholder-${index}`" class="board-match-preview board-match-preview--placeholder" aria-hidden="true" />
    </template>
    <p class="board-match-previews-empty" role="status" aria-live="polite">{{ !loading && !assets.length ? 'No matching assets' : '' }}</p>
  </div>
</template>

<style scoped>
.board-match-previews {
  --board-match-preview-radius: max(0px, calc(var(--radius) * 1.5 - var(--filter-option-padding)));
  min-width: 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: var(--filter-overlay-row-height);
  gap: var(--filter-option-gap);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
  border-radius: var(--board-match-preview-radius);
}

.board-match-previews::-webkit-scrollbar {
  display: none;
}

.board-match-previews.is-empty {
  min-height: var(--filter-overlay-row-height);
  grid-auto-flow: row;
  grid-auto-columns: auto;
  place-items: center;
  overflow: hidden;
  touch-action: auto;
  background: var(--filter-overlay-nested-background);
}

.board-match-previews-empty {
  margin: 0;
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-option-font-size);
  font-weight: 500;
}

.board-match-previews-empty:empty {
  display: none;
}

.board-match-preview {
  min-width: 0;
  aspect-ratio: 1;
  display: block;
  overflow: hidden;
  border-radius: var(--board-match-preview-radius);
  background: var(--filter-overlay-nested-background);
  box-shadow: inset 0 0 0 1px oklch(1 0 0 / .1);
  content-visibility: auto;
  contain-intrinsic-size: var(--filter-overlay-row-height);
}

.board-match-preview :deep(:is(img, video)) {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.board-match-preview--placeholder {
  opacity: .45;
}
</style>
