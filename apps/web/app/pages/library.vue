<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const route = useRoute()
const router = useRouter()

interface AssetCard {
  id: string; title: string; previewUrl: string; width: number; height: number; status: string; figma_url: string
  created_at: string; projects: { name: string } | null
  asset_tags: Array<{ tags: { id: string; name: string; slug: string } | null }>
  allowed_users: { figma_handle: string | null; avatar_url: string | null } | null
}
interface Submitter { id: string; figma_handle: string | null; avatar_url: string | null }
interface AssetList { data: { assets: AssetCard[]; submitters: Submitter[]; total: number; page: number; pageSize: number } }
interface SessionResponse { data: { authenticated: boolean; user?: { role: string } } }

const search = ref('')
const status = ref('')
const sort = ref('newest')
const page = ref(1)
const query = computed(() => ({ search: search.value, ...(status.value ? { status: status.value } : {}), sort: sort.value, page: page.value }))
const { data, status: loadStatus, error, refresh } = await useFetch<AssetList>('/api/assets', { query, watch: [query] })
const assets = ref<AssetCard[]>([])
const cardsHidden = ref(false)
let cardSwapTimer: ReturnType<typeof setTimeout> | undefined
watch(() => data.value?.data.assets, (next) => {
  const incoming = next ?? []
  if (!assets.value.length) { assets.value = incoming; return }
  clearTimeout(cardSwapTimer)
  cardSwapTimer = setTimeout(async () => {
    assets.value = incoming
    await nextTick()
    requestAnimationFrame(() => { cardsHidden.value = false })
  }, 180)
}, { immediate: true })
const submitters = computed(() => data.value?.data.submitters ?? [])
const visibleSubmitters = computed(() => submitters.value.slice(0, 5))
const submitterName = (submitter: Submitter) => submitter.figma_handle || 'Unknown submitter'
const submitterInitial = (submitter: Submitter) => submitterName(submitter).trim().charAt(0).toUpperCase() || '?'
const total = computed(() => data.value?.data.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / 24)))
const resultMessage = computed(() => loadStatus.value === 'success' ? `${total.value} ${total.value === 1 ? 'asset' : 'assets'}` : '')
const { data: session } = await useFetch<SessionResponse>('/api/auth/session')
const isAdmin = computed(() => session.value?.data?.user?.role === 'admin')
const canShare = computed(() => ['editor', 'admin'].includes(session.value?.data?.user?.role ?? ''))
const selectedAssetId = computed(() => typeof route.query.asset === 'string' ? route.query.asset : '')
const closeAsset = () => router.replace({ path: '/library' })
const toolbarVisible = ref(true)
let lastScrollY = 0
let scrollFrame = 0
const updateToolbar = () => {
  cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    const current = Math.max(window.scrollY, 0)
    const delta = current - lastScrollY
    if (current <= 48 || delta < -2) toolbarVisible.value = true
    else if (delta > 2) toolbarVisible.value = false
    lastScrollY = current
  })
}
watch([search, status, sort], () => { page.value = 1; if (assets.value.length) cardsHidden.value = true })
watch(page, () => { if (assets.value.length) cardsHidden.value = true })
onMounted(() => { lastScrollY = window.scrollY; window.addEventListener('scroll', updateToolbar, { passive: true }) })
onBeforeUnmount(() => { clearTimeout(cardSwapTimer); cancelAnimationFrame(scrollFrame); window.removeEventListener('scroll', updateToolbar) })
</script>

<template>
  <div class="library-shell">
    <main id="main-content">
      <header class="index-toolbar" :class="{ 'toolbar-hidden': !toolbarVisible }">
        <NuxtLink class="brand" to="/library">Content Library</NuxtLink>
        <form class="filters" role="search" @submit.prevent><label class="search-field"><span class="sr-only">Search assets</span><input v-model="search" type="search" name="search" placeholder="Search"></label><label><span class="sr-only">Status</span><select v-model="status" name="status"><option value="">All statuses</option><option value="approved">Approved</option><option value="draft">Draft</option></select></label><label><span class="sr-only">Sort</span><select v-model="sort" name="sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option><option value="title">Title</option><option value="dimensions">Dimensions</option><option value="submitter">Submitter</option></select></label><div v-if="submitters.length" class="submitter-stack" role="list" aria-label="People who submitted assets"><span v-for="submitter in visibleSubmitters" :key="submitter.id" class="submitter-avatar" role="listitem" :title="submitterName(submitter)"><img v-if="submitter.avatar_url" :src="submitter.avatar_url" alt=""><span v-else aria-hidden="true">{{ submitterInitial(submitter) }}</span><span class="sr-only">{{ submitterName(submitter) }}</span></span><span v-if="submitters.length > visibleSubmitters.length" class="submitter-more" :title="`${submitters.length-visibleSubmitters.length} more submitters`">+{{ submitters.length-visibleSubmitters.length }}</span></div></form>
        <p class="count sr-only" role="status" aria-live="polite">{{ resultMessage }}</p>
        <nav aria-label="Account"><ShareCollection v-if="canShare" :current-search="search" /><NuxtLink v-if="isAdmin" to="/admin/users">Admin</NuxtLink><NuxtLink to="/login">Account</NuxtLink></nav>
      </header>

      <div v-if="loadStatus === 'pending' && assets.length === 0" class="state" role="status">Loading assets…</div>
      <div v-else-if="error" class="state error" role="alert"><strong>Unable to load assets.</strong><span>Check your connection and try again.</span><button type="button" @click="refresh()">Try again</button></div>
      <div v-else-if="assets.length === 0" class="state"><strong>{{ search || status ? 'No matching assets' : 'No assets yet' }}</strong><span>{{ search || status ? 'Change your search or clear the filters.' : 'Upload frames from the Figma plugin to build this library.' }}</span><button v-if="search || status" type="button" @click="search = ''; status = ''">Clear filters</button></div>
      <AssetMasonry v-else :assets="assets" :hidden="cardsHidden" interactive />
      <nav v-if="totalPages > 1" class="pagination" aria-label="Pagination"><button :disabled="page === 1" @click="page--">Previous</button><span>Page {{ page }} of {{ totalPages }}</span><button :disabled="page === totalPages" @click="page++">Next</button></nav>
    </main>
    <AssetOverlay v-if="selectedAssetId" :asset-id="selectedAssetId" @close="closeAsset" />
  </div>
</template>

<style scoped>
.library-shell{--space:clamp(12px,1vw,24px);--muted:.45;min-height:100vh;color:#000;background:#fff;font-family:"Helvetica Now Display","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:-.015em;line-height:1.15}main{min-height:100vh;padding:var(--space)}.index-toolbar{position:sticky;z-index:4;top:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:var(--space);min-height:68px;margin-top:calc(var(--space)*-1);padding:var(--space) 0;background:rgb(255 255 255/.95);backdrop-filter:blur(12px)}.brand{text-decoration:none}.filters{grid-column:span 2;display:flex;flex-wrap:wrap;gap:2px var(--space)}.filters label{min-width:7rem;flex:1}.filters input,.filters select{width:100%;min-height:24px;padding:0;border:0;border-bottom:1px solid rgb(0 0 0/.18);border-radius:0;color:inherit;background:transparent;font:inherit}.filters input::placeholder{color:inherit;opacity:var(--muted)}.count{margin:0;opacity:var(--muted);text-align:right;font-variant-numeric:tabular-nums}.index-toolbar nav{position:absolute;top:calc(var(--space) + 27px);right:0;display:flex;gap:var(--space)}.index-toolbar nav a{text-decoration:none}.masonry{column-count:6;column-gap:var(--space)}.asset-card{display:inline-block;width:100%;break-inside:avoid;margin-bottom:calc(var(--space)*2);color:inherit;background:transparent;text-decoration:none}.preview{overflow:hidden;border-radius:8px;background:transparent;clip-path:inset(0 round 8px)}.preview img{display:block;width:100%;height:100%;object-fit:cover}.asset-card:hover{opacity:1}.card-body{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space);padding-top:8px}.card-body h2,.card-body p{margin:0;font:inherit}.card-body p,.card-body>span{opacity:.3}.card-body>span{text-transform:capitalize}.state{min-height:45vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center}.state span{opacity:var(--muted)}button{min-height:44px;padding:0 18px;border:0;border-radius:999px;color:white;background:black;font:inherit;cursor:pointer;transition-property:scale,opacity;transition-duration:150ms}.state button:active,.pagination button:active{scale:.96}.pagination{display:flex;align-items:center;justify-content:center;gap:var(--space);padding:calc(var(--space)*2) 0}.pagination span{opacity:var(--muted)}:is(a,input,select,button):focus-visible{outline:2px solid #06f90e;outline-offset:2px}.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}@media(max-width:2200px){.masonry{column-count:5}}@media(max-width:1680px){.masonry{column-count:4}}@media(max-width:1280px){.masonry{column-count:3}}@media(max-width:900px){.index-toolbar{grid-template-columns:1fr 2fr auto}.filters{grid-column:auto}.count{display:none}.masonry{column-count:2}}@media(max-width:520px){.index-toolbar{grid-template-columns:1fr auto;gap:8px}.brand{grid-column:1}.filters{grid-column:1/-1;grid-row:2}.index-toolbar nav{position:static;grid-column:2;grid-row:1}.card-body{font-size:14px}.masonry{column-count:1}}@media(prefers-reduced-motion:reduce){.preview img,button{transition:none}.state button:active,.pagination button:active{scale:1}}
.index-toolbar{transition:opacity .18s ease-out,transform .24s cubic-bezier(.2,0,0,1)}
.library-shell{--space:inherit}
.index-toolbar.toolbar-hidden{pointer-events:none;opacity:0;transform:translateY(calc(-100% - var(--space)))}
.index-toolbar{min-height:0}
.brand,.index-toolbar nav,.filters{min-height:44px;align-items:center}.brand{display:flex}
.index-toolbar nav{position:static;display:flex;justify-content:flex-end;gap:var(--space)}
.count{position:absolute}
.filters label{position:relative;box-sizing:border-box;height:44px;border-bottom:1px solid rgb(0 0 0/.18)}
.filters input,.filters select{box-sizing:border-box;height:43px;min-height:43px;padding:0 28px 0 8px;border:0;appearance:none;line-height:1.15}
.filters .search-field input{padding-right:8px}
.filters label:not(.search-field)::after{content:"";position:absolute;top:16px;right:8px;width:8px;height:8px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);pointer-events:none}
.filters input::-webkit-search-cancel-button{appearance:none}
.filters :is(input,select):focus-visible{outline:0;background:#f3f3f3}
.preview{position:relative}.preview-link{display:block;width:100%;height:100%}.preview-link:hover,.card-body a:hover{opacity:1}.card-body a{text-decoration:none}.figma-button{position:absolute;z-index:2;left:50%;bottom:12px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border-radius:999px;color:#fff;background:#000;text-decoration:none;white-space:nowrap;opacity:0;transform:translate(-50%,8px);pointer-events:none;transition-property:opacity,transform,scale;transition-duration:150ms;transition-timing-function:cubic-bezier(.2,0,0,1)}.asset-card:hover .figma-button,.asset-card:focus-within .figma-button{opacity:1;transform:translate(-50%,0);pointer-events:auto}.figma-button:hover{opacity:.8}.figma-button:active{scale:.96}.figma-button:focus-visible{outline:2px solid #06f90e;outline-offset:2px}
.figma-button{bottom:10px;min-height:32px;padding:0 13px;color:#000;background:#fff;font-size:12px;box-shadow:0 1px 3px rgb(0 0 0/.12)}
.submitter-stack{min-width:max-content;height:var(--control-height);display:flex;align-items:center;padding-left:calc(var(--space)/2)}.submitter-avatar,.submitter-more{width:30px;height:30px;display:grid;place-items:center;border:2px solid var(--color-bg);border-radius:50%;overflow:hidden;background:var(--color-surface);font-size:11px}.submitter-avatar+.submitter-avatar,.submitter-more{margin-left:-8px}.submitter-avatar img{width:100%;height:100%;object-fit:cover}.submitter-more{width:auto;min-width:30px;padding:0 7px;border-radius:999px;overflow:visible}.filters label{border-color:var(--color-line)}.filters :is(input,select):focus-visible{background:var(--color-surface)}
.preview{background:transparent}.preview.is-loading{background:var(--color-surface)}.preview img{opacity:0;transition:opacity .22s ease-out}.preview img.is-loaded{opacity:1}
.asset-card{opacity:1;transform:translateY(0);transition-property:opacity,transform;transition-duration:.18s,.22s;transition-delay:var(--card-stagger,0ms);transition-timing-function:ease-out,cubic-bezier(.16,1.35,.3,1);animation:card-fade-in .42s cubic-bezier(.16,1.35,.3,1) backwards;animation-delay:var(--card-stagger,0ms)}.masonry.cards-hidden .asset-card{opacity:0;transform:translateY(16px);transition-delay:0ms}@keyframes card-fade-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@media(forced-colors:active){.filters :is(input,select):focus-visible{outline:2px solid CanvasText;outline-offset:2px}}
@media(prefers-reduced-motion:reduce){.index-toolbar{transition-duration:.01ms}.asset-card{transition:none;animation:none}.masonry.cards-hidden .asset-card{opacity:1;transform:none}.preview img{transition:none}.figma-button{transition-duration:.01ms;transform:translate(-50%,0)}.figma-button:active{scale:1}}
</style>
