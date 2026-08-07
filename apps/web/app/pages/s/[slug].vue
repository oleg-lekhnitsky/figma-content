<script setup lang="ts">
const route = useRoute()
interface PublicAsset { id: string; title: string; description: string|null; previewUrl: string; width: number; height: number; projects: { name: string } | null; asset_tags: Array<{ tags: { name: string } | null }> }
interface PublicResponse { data: { collection: { title: string; mode: 'dynamic' | 'static'; expiresAt: string | null; updatedAt: string; organization: { name: string } | null }; assets: PublicAsset[] } }
const { data, status, error } = await useFetch<PublicResponse>(() => `/api/public/collections/${String(route.params.slug)}`)
const collection = computed(() => data.value?.data.collection)
const assets = computed(() => data.value?.data.assets ?? [])
useHead(() => ({ title: collection.value?.title ?? 'Shared collection' }))
</script>

<template>
  <main class="public-library">
    <header v-if="collection">
      <h1>{{ collection.title }}</h1>
      <div class="meta">
        <span>{{ assets.length }} {{ assets.length === 1 ? 'item' : 'items' }}</span>
        <span>{{ collection.mode === 'dynamic' ? 'Updates automatically' : `Updated ${new Date(collection.updatedAt).toLocaleDateString()}` }}</span>
      </div>
    </header>
    <div v-if="status === 'pending'" class="state" role="status">Loading collection…</div>
    <div v-else-if="error" class="state" role="alert"><strong>Collection unavailable</strong><span>The link may have expired or been disabled.</span></div>
    <div v-else-if="assets.length === 0" class="state"><strong>No approved items yet</strong><span>This collection will show items when they are available.</span></div>
    <AssetMasonry v-else :assets="assets" label="Shared assets" />
  </main>
</template>

<style scoped>
.public-library{min-height:100vh;padding:var(--page-padding);color:var(--color-fg);background:var(--color-bg);font-weight:700}header{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:var(--space);padding:0 0 clamp(2.5rem,5vw,5rem)}h1{grid-column:1 / 3}.meta{grid-column:3 / 5;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space);padding-top:4px;color:var(--color-muted)}.state{min-height:50vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center}.state span{color:var(--color-muted)}@media(max-width:900px){header{grid-template-columns:repeat(2,minmax(0,1fr))}h1{grid-column:1 / 3}.meta{grid-column:1 / 3}}@media(max-width:560px){header{grid-template-columns:1fr}h1,.meta{grid-column:1}.meta{grid-template-columns:1fr;padding-top:0}}
</style>
