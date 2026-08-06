<script setup lang="ts">
const route = useRoute()
interface PublicAsset { id: string; title: string; previewUrl: string; width: number; height: number; created_at: string; projects: { name: string } | null; asset_tags: Array<{ tags: { name: string } | null }> }
interface PublicResponse { data: { collection: { title: string; mode: 'dynamic' | 'static'; expiresAt: string | null; updatedAt: string; organization: { name: string } | null }; assets: PublicAsset[] } }
const { data, status, error } = await useFetch<PublicResponse>(() => `/api/public/collections/${String(route.params.slug)}`)
const collection = computed(() => data.value?.data.collection)
const assets = computed(() => data.value?.data.assets ?? [])
useHead(() => ({ title: collection.value ? `${collection.value.title} — Content Library` : 'Shared collection' }))
</script>

<template>
  <main class="public-library">
    <header v-if="collection"><div><p>{{ collection.organization?.name ?? 'Content Library' }}</p><h1>{{ collection.title }}</h1></div><div class="meta"><span>{{ assets.length }} {{ assets.length === 1 ? 'item' : 'items' }}</span><span>{{ collection.mode === 'dynamic' ? 'Updates automatically' : `Updated ${new Date(collection.updatedAt).toLocaleDateString()}` }}</span></div></header>
    <div v-if="status === 'pending'" class="state" role="status">Loading collection…</div>
    <div v-else-if="error" class="state" role="alert"><strong>Collection unavailable</strong><span>The link may have expired or been disabled.</span></div>
    <div v-else-if="assets.length === 0" class="state"><strong>No approved items yet</strong><span>This collection will show items when they are available.</span></div>
    <section v-else class="public-masonry" aria-label="Shared assets"><article v-for="asset in assets" :key="asset.id"><div class="preview" :style="{ aspectRatio: `${asset.width} / ${asset.height}` }"><img :src="asset.previewUrl" :alt="asset.title" loading="lazy"></div><div class="caption"><div><h2>{{ asset.title }}</h2><p>{{ asset.projects?.name ?? 'No project' }}<template v-if="asset.asset_tags.length"> · {{ asset.asset_tags.map(link => link.tags?.name).filter(Boolean).join(', ') }}</template></p></div><time :datetime="asset.created_at">{{ new Date(asset.created_at).toLocaleDateString() }}</time></div></article></section>
  </main>
</template>

<style scoped>
.public-library{min-height:100vh;padding:var(--space);color:var(--color-fg);background:var(--color-bg);font-weight:700}header{display:grid;grid-template-columns:3fr 1fr;gap:var(--space);padding:clamp(2rem,7vw,7rem) 0 clamp(4rem,10vw,10rem)}header p,h1{margin:0}header p,.meta{color:var(--color-muted)}h1{max-width:14ch;font-size:var(--font-size-h1);letter-spacing:-.055em;line-height:.9}.meta{display:flex;justify-content:space-between;gap:var(--space);align-self:end}.public-masonry{column-count:6;column-gap:var(--space)}article{display:inline-block;width:100%;break-inside:avoid;margin-bottom:calc(var(--space)*2)}.preview{overflow:hidden;border-radius:8px;background:var(--color-surface);clip-path:inset(0 round 8px)}img{display:block;width:100%;height:100%;object-fit:cover}.caption{display:flex;justify-content:space-between;gap:var(--space);padding-top:8px}.caption h2,.caption p{margin:0;font:inherit}.caption p,time{color:var(--color-muted)}time{white-space:nowrap}.state{min-height:50vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center}.state span{color:var(--color-muted)}@media(max-width:2200px){.public-masonry{column-count:5}}@media(max-width:1680px){.public-masonry{column-count:4}}@media(max-width:1280px){.public-masonry{column-count:3}}@media(max-width:900px){header{grid-template-columns:1fr}.meta{justify-content:flex-start}.public-masonry{column-count:2}}@media(max-width:520px){.public-masonry{column-count:1}.caption{font-size:14px}}
</style>
