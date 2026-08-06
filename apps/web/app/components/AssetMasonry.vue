<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

interface AssetMasonryItem {
  id: string
  title: string
  previewUrl: string
  width: number
  height: number
  status?: string
  figma_url?: string
  created_at?: string
  projects: { name: string } | null
  asset_tags: Array<{ tags: { name: string } | null }>
}

const props = withDefaults(defineProps<{
  assets: AssetMasonryItem[]
  interactive?: boolean
  hidden?: boolean
  label?: string
}>(), {
  interactive: false,
  hidden: false,
  label: 'Assets'
})

const loadedImages = reactive(new Set<string>())
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
const observeCards = () => {
  resizeObserver?.disconnect()
  if (!masonry.value) return
  resizeObserver = new ResizeObserver(measureCards)
  resizeObserver.observe(masonry.value)
  for (const card of masonry.value.querySelectorAll('.asset-card')) resizeObserver.observe(card)
  measureCards()
}
const markImageLoaded = (id: string) => {
  loadedImages.add(id)
  nextTick(measureCards)
}
const projectAndTags = (asset: AssetMasonryItem) => {
  const tags = asset.asset_tags.slice(0, 2).map(link => link.tags?.name).filter(Boolean)
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
  <section ref="masonry" class="asset-masonry" :class="{ 'cards-hidden': hidden }" :aria-label="label">
    <article v-for="(asset, index) in assets" :key="asset.id" class="asset-card" :style="{ '--card-stagger': cardStagger(index) }">
      <div class="preview" :class="{ 'is-loading': !loadedImages.has(asset.id) }" :style="{ aspectRatio: `${asset.width} / ${asset.height}` }">
        <NuxtLink v-if="interactive" class="preview-link" :to="assetLink(asset.id)" :aria-label="`View ${asset.title}`">
          <img :class="{ 'is-loaded': loadedImages.has(asset.id) }" :src="asset.previewUrl" :alt="`Preview of ${asset.title}`" loading="lazy" @load="markImageLoaded(asset.id)">
        </NuxtLink>
        <img v-else :class="{ 'is-loaded': loadedImages.has(asset.id) }" :src="asset.previewUrl" :alt="asset.title" loading="lazy" @load="markImageLoaded(asset.id)">
        <a v-if="interactive && asset.figma_url" class="figma-button" :href="asset.figma_url" target="_blank" rel="noopener noreferrer">Open in Figma</a>
      </div>
      <div class="card-body">
        <div>
          <h2><NuxtLink v-if="interactive" :to="assetLink(asset.id)">{{ asset.title }}</NuxtLink><template v-else>{{ asset.title }}</template></h2>
          <p>{{ projectAndTags(asset) }}</p>
        </div>
        <span v-if="interactive" class="card-meta card-status">{{ asset.status }}</span>
        <time v-else-if="asset.created_at" class="card-meta" :datetime="asset.created_at">{{ new Date(asset.created_at).toLocaleDateString() }}</time>
      </div>
    </article>
  </section>
</template>

<style scoped>
.asset-masonry{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));column-gap:var(--space);align-items:start}.asset-masonry.is-masonry{grid-auto-rows:1px;row-gap:0}
.asset-card{min-width:0;padding-bottom:calc(var(--space)*2);color:inherit;background:transparent;opacity:1;transform:translateY(0);transition-property:opacity,transform;transition-duration:.18s,.22s;transition-delay:var(--card-stagger,0ms);transition-timing-function:ease-out,cubic-bezier(.16,1.35,.3,1);animation:card-fade-in .42s cubic-bezier(.16,1.35,.3,1) backwards;animation-delay:var(--card-stagger,0ms)}.asset-masonry.is-masonry .asset-card{grid-row-end:span var(--card-rows)}
.preview{position:relative;overflow:hidden;border-radius:var(--radius);background:transparent;clip-path:inset(0 round var(--radius))}.preview.is-loading{background:var(--color-surface)}
.preview-link{display:block;width:100%;height:100%}.preview-link:hover,.card-body a:hover{opacity:1}
.preview img{display:block;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .22s ease-out}.preview img.is-loaded{opacity:1}
.card-body{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space);padding-top:8px}.card-body h2,.card-body p{margin:0;font:inherit}.card-body a{text-decoration:none}.card-body p,.card-meta{opacity:.3}.card-meta{white-space:nowrap}.card-status{text-transform:capitalize}
.figma-button{position:absolute;z-index:2;left:50%;bottom:10px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0 13px;border-radius:999px;color:#000;background:#fff;font-size:12px;text-decoration:none;white-space:nowrap;box-shadow:0 1px 3px rgb(0 0 0/.12);opacity:0;transform:translate(-50%,8px);pointer-events:none;transition-property:opacity,transform,scale;transition-duration:150ms;transition-timing-function:cubic-bezier(.2,0,0,1)}
.asset-card:hover .figma-button,.asset-card:focus-within .figma-button{opacity:1;transform:translate(-50%,0);pointer-events:auto}.figma-button:hover{opacity:.8}.figma-button:active{scale:.96}.figma-button:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.asset-masonry.cards-hidden .asset-card{opacity:0;transform:translateY(16px);transition-delay:0ms}
@keyframes card-fade-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:2200px){.asset-masonry{grid-template-columns:repeat(5,minmax(0,1fr))}}
@media(max-width:1680px){.asset-masonry{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1280px){.asset-masonry{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:900px){.asset-masonry{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.asset-masonry{grid-template-columns:minmax(0,1fr)}.card-body{font-size:14px}}
@media(prefers-reduced-motion:reduce){.asset-card{transition:none;animation:none}.asset-masonry.cards-hidden .asset-card{opacity:1;transform:none}.preview img{transition:none}.figma-button{transition-duration:.01ms;transform:translate(-50%,0)}.figma-button:active{scale:1}}
</style>
