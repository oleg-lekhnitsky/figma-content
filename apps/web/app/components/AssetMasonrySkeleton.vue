<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading assets' })

const ratios = ['4 / 5', '1 / 1', '3 / 4', '4 / 5', '1 / 1', '3 / 4', '4 / 5', '1 / 1']
</script>

<template>
  <div class="asset-skeleton-state" role="status">
    <span class="sr-only">{{ label }}</span>
    <div class="asset-skeleton-grid" aria-hidden="true">
      <article v-for="(ratio, index) in ratios" :key="index" class="asset-skeleton-card">
        <span class="asset-skeleton-preview" :style="{ aspectRatio: ratio }" />
        <span class="asset-skeleton-line" />
        <span class="asset-skeleton-line is-short" />
      </article>
    </div>
  </div>
</template>

<style>
.asset-skeleton-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));align-items:start;gap:calc(var(--space)*2) var(--space)}
.asset-skeleton-card{min-width:0;display:grid;gap:8px}
.asset-skeleton-preview,.asset-skeleton-line{display:block;border-radius:var(--radius);background:var(--color-surface)}
.asset-skeleton-line{width:72%;height:1em;border-radius:999px}
.asset-skeleton-line.is-short{width:42%;opacity:.65}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(prefers-reduced-motion:no-preference){.asset-skeleton-preview,.asset-skeleton-line{animation:asset-skeleton-pulse 1.2s ease-in-out infinite alternate}@keyframes asset-skeleton-pulse{to{opacity:.55}}}
@media(max-width:2200px){.asset-skeleton-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
@media(max-width:1680px){.asset-skeleton-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1280px){.asset-skeleton-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:900px){.asset-skeleton-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.asset-skeleton-grid{width:calc(100% + var(--space));margin-inline:calc(var(--space)/-2);grid-template-columns:repeat(2,minmax(0,1fr));gap:calc(var(--space)/3) calc(var(--space)/2)}.asset-skeleton-preview{border-radius:var(--radius-mobile)}}
</style>
