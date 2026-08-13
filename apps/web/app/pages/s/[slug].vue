<script setup lang="ts">
import type { BoardLayout, BoardViewSettings } from '@content-library/shared'

const route = useRoute()
interface PublicAsset { id: string; title: string; description: string|null; previewUrl: string; preview2xUrl?: string|null; width: number; height: number; projects: { name: string } | null; asset_tags: Array<{ tags: { name: string } | null }> }
interface PortfolioCase { id:string; title:string; layout:BoardLayout; viewSettings:BoardViewSettings; assets:PublicAsset[] }
interface PublicResponse { data: { collection: { title: string; purpose: 'showcase' | 'review' | 'portfolio'; portfolioKind:string|null; portfolioClient:string|null; introduction:string|null; contactHeading:string|null; contactLinks:Array<{label:string;url:string}>; mode: 'dynamic' | 'static'; layout: BoardLayout; viewSettings:BoardViewSettings; expiresAt: string | null; updatedAt: string; organization: { name: string } | null }; assets: PublicAsset[]; cases:PortfolioCase[] } }
const { data, status, error } = await useFetch<PublicResponse>(() => `/api/public/collections/${String(route.params.slug)}`)
const collection = computed(() => data.value?.data.collection)
const assets = computed(() => data.value?.data.assets ?? [])
const cases = computed(() => data.value?.data.cases ?? [])
useHead(() => ({ title: collection.value?.title ?? 'Shared collection' }))
</script>

<template>
  <main class="public-library">
    <header v-if="collection">
      <h1>{{ collection.title }}</h1>
      <div class="meta">
        <span>{{ collection.purpose === 'portfolio' ? `${cases.length} ${cases.length === 1 ? 'case' : 'cases'}` : `${assets.length} ${assets.length === 1 ? 'item' : 'items'}` }}</span>
        <span>{{ collection.purpose === 'portfolio' ? (collection.portfolioKind === 'client' ? `Prepared for ${collection.portfolioClient}` : collection.organization?.name ?? 'Portfolio') : collection.mode === 'dynamic' ? 'Updates automatically' : `Updated ${new Date(collection.updatedAt).toLocaleDateString()}` }}</span>
      </div>
      <p v-if="collection.purpose === 'portfolio' && collection.introduction" class="introduction">{{ collection.introduction }}</p>
    </header>
    <div v-if="status === 'pending'" class="state" role="status">Loading collection…</div>
    <div v-else-if="error" class="state" role="alert"><strong>Collection unavailable</strong><span>The link may have expired or been disabled.</span></div>
    <div v-else-if="collection?.purpose === 'portfolio' && cases.length === 0" class="state"><strong>No cases published yet</strong><span>This portfolio edition is still being prepared.</span></div>
    <section v-else-if="collection?.purpose === 'portfolio'" class="portfolio-cases" aria-label="Portfolio cases"><article v-for="portfolioCase in cases" :key="portfolioCase.id"><h2>{{ portfolioCase.title }}</h2><BoardLayoutRenderer :assets="portfolioCase.assets" :layout="portfolioCase.layout" :view-settings="portfolioCase.viewSettings" :label="`${portfolioCase.title} case study`"><template #details="{asset}"><p v-if="asset.description">{{ asset.description }}</p></template></BoardLayoutRenderer></article></section>
    <div v-else-if="assets.length === 0" class="state"><strong>No approved items yet</strong><span>This collection will show items when they are available.</span></div>
    <BoardLayoutRenderer v-else-if="collection" :assets="assets" :layout="collection.layout" :view-settings="collection.viewSettings" label="Shared assets"><template #details="{asset}"><p v-if="asset.description">{{ asset.description }}</p></template></BoardLayoutRenderer>
    <footer v-if="collection?.purpose === 'portfolio' && (collection.contactHeading || collection.contactLinks?.length)" class="portfolio-contact">
      <p>Contact</p>
      <h2>{{ collection.contactHeading || 'Get in touch' }}</h2>
      <div class="contact-links"><a v-for="link in collection.contactLinks" :key="`${link.label}:${link.url}`" :href="link.url" :target="link.url.startsWith('http') ? '_blank' : undefined" :rel="link.url.startsWith('http') ? 'noopener noreferrer' : undefined">{{ link.label }}</a></div>
    </footer>
  </main>
</template>

<style scoped>
.public-library{min-height:100vh;padding:var(--page-padding);color:var(--color-fg);background:var(--color-bg);font-weight:700}header{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:var(--space);padding:0 0 clamp(2.5rem,5vw,5rem)}h1{grid-column:1 / 3}.meta{grid-column:3 / 5;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space);padding-top:4px;color:var(--color-muted)}.introduction{grid-column:1 / 3;max-width:50rem;margin:0;color:var(--color-muted)}.portfolio-cases{display:grid;gap:clamp(5rem,10vw,10rem)}.portfolio-cases article{display:grid;gap:var(--space)}.portfolio-cases h2{margin:0}.portfolio-contact{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--space);align-items:end;min-height:70vh;padding-top:var(--section-gap);padding-bottom:var(--section-gap)}.portfolio-contact>p{margin:0;color:var(--color-muted)}.portfolio-contact h2{grid-column:2 / 5}.contact-links{grid-column:2 / 5;display:flex;flex-wrap:wrap;gap:var(--space)}.contact-links a{text-decoration:underline;text-underline-offset:.14em}.state{min-height:50vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center}.state span{color:var(--color-muted)}@media(max-width:900px){header{grid-template-columns:repeat(2,minmax(0,1fr))}h1{grid-column:1 / 3}.meta{grid-column:1 / 3}.portfolio-contact{grid-template-columns:1fr 1fr}.portfolio-contact h2,.contact-links{grid-column:2}}@media(max-width:560px){header{grid-template-columns:1fr}h1,.meta,.introduction{grid-column:1}.meta{grid-template-columns:1fr;padding-top:0}.portfolio-contact{grid-template-columns:1fr}.portfolio-contact h2,.contact-links{grid-column:1}}
</style>
