<script setup lang="ts">
defineProps<{
  assets: Array<{
    id: string
    title: string
    previewUrl: string
    mime_type: string
    width: number
    height: number
  }>
}>()
</script>

<template>
  <div v-if="assets.length" class="board-match-previews" role="region" aria-label="Matching asset previews" tabindex="0">
    <span v-for="asset in assets" :key="asset.id" class="board-match-preview">
      <AssetMedia :src="asset.previewUrl" :mime-type="asset.mime_type" :width="asset.width" :height="asset.height" :alt="asset.title" loading="lazy" />
    </span>
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
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline proximity;
  scrollbar-width: thin;
  border-radius: var(--board-match-preview-radius);
}

.board-match-preview {
  min-width: 0;
  aspect-ratio: 1;
  display: block;
  overflow: hidden;
  scroll-snap-align: start;
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
}
</style>
