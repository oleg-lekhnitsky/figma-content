<script setup lang="ts">
import type { BoardViewSettings } from '@content-library/shared'
import { boardViewStyle } from '../utils/board-view-style'

const props = withDefaults(defineProps<{
  label?: string
  viewSettings?: BoardViewSettings
  ratios?: string[]
  count?: number
}>(), {
  label: 'Loading assets',
  ratios: () => [],
  count: 8
})

const fallbackRatios = ['4 / 5', '1 / 1', '3 / 4']
const ratios = computed(() => Array.from(
  { length: Math.max(props.ratios.length, Math.min(props.count, 24)) },
  (_, index) => props.ratios[index] ?? fallbackRatios[index % fallbackRatios.length]
))
const viewStyle = computed(() => props.viewSettings ? boardViewStyle(props.viewSettings) : undefined)
</script>

<template>
  <div class="asset-skeleton-state" role="status">
    <span class="sr-only">{{ label }}</span>
    <div class="asset-skeleton-grid" :class="{ 'custom-view': props.viewSettings, 'hide-text': props.viewSettings && !props.viewSettings.showText }" :style="viewStyle" aria-hidden="true">
      <article v-for="(ratio, index) in ratios" :key="index" class="asset-skeleton-card">
        <span class="asset-skeleton-preview" :style="{ aspectRatio: ratio }" />
        <span class="asset-skeleton-line" />
        <span class="asset-skeleton-line is-short" />
      </article>
    </div>
  </div>
</template>

<style>
.asset-skeleton-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:start;gap:calc(var(--space)*2) var(--space)}
.asset-skeleton-card{min-width:0;display:grid;gap:8px}
.asset-skeleton-preview,.asset-skeleton-line{display:block;border-radius:var(--board-radius,var(--radius));background:var(--color-surface)}
.asset-skeleton-line{width:72%;height:1em;border-radius:999px}
.asset-skeleton-line.is-short{width:42%;opacity:.65}
.asset-skeleton-grid.custom-view{grid-template-columns:repeat(clamp(1,calc(7 + var(--board-column-offset,0)),9),minmax(0,1fr));column-gap:var(--board-gap);row-gap:0}
.asset-skeleton-grid.custom-view .asset-skeleton-card{padding-bottom:var(--board-gap)}
.asset-skeleton-grid.hide-text .asset-skeleton-line{display:none}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(prefers-reduced-motion:no-preference){.asset-skeleton-preview,.asset-skeleton-line{animation:asset-skeleton-pulse 1.2s ease-in-out infinite alternate}@keyframes asset-skeleton-pulse{to{opacity:.55}}}
@media(max-width:2200px){.asset-skeleton-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.asset-skeleton-grid.custom-view{grid-template-columns:repeat(clamp(1,calc(6 + var(--board-column-offset,0)),8),minmax(0,1fr))}}
@media(max-width:1680px){.asset-skeleton-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.asset-skeleton-grid.custom-view{grid-template-columns:repeat(clamp(1,calc(5 + var(--board-column-offset,0)),7),minmax(0,1fr))}}
@media(max-width:1280px){.asset-skeleton-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.asset-skeleton-grid.custom-view{grid-template-columns:repeat(clamp(1,calc(4 + var(--board-column-offset,0)),6),minmax(0,1fr))}}
@media(max-width:900px){.asset-skeleton-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.asset-skeleton-grid.custom-view{grid-template-columns:repeat(clamp(1,calc(3 + var(--board-column-offset,0)),5),minmax(0,1fr))}}
@media(max-width:520px){.asset-skeleton-grid{--board-default-gap:var(--masonry-mobile-column-gap);width:calc(100% + var(--masonry-mobile-inline-bleed)*2);margin-inline:calc(var(--masonry-mobile-inline-bleed)*-1);grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--masonry-mobile-row-gap) var(--masonry-mobile-column-gap)}.asset-skeleton-grid.custom-view{grid-template-columns:repeat(clamp(1,calc(2 + var(--board-column-offset,0)),4),minmax(0,1fr));row-gap:0}.asset-skeleton-preview{border-radius:var(--board-radius,var(--radius-mobile))}}
</style>
