<script setup lang="ts">
import { Plus, Search, X } from 'reicon-vue'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const router = useRouter()

interface AssetCard {
  id: string; title: string; description?: string|null; previewUrl: string; preview2xUrl?: string|null; width: number; height: number; status?: string; figma_url?: string
  created_at?: string; updated_at?: string; projects?: { name: string } | null
  asset_tags?: Array<{ tags: { id?: string; name: string; slug?: string } | null }>
  allowed_users?: { figma_handle: string | null; avatar_url: string | null } | null
}
interface Submitter { id: string; figma_handle: string | null; avatar_url: string | null }
interface Project { id: string; name: string; slug: string }
interface Tag { id: string; name: string; slug: string }
interface AssetList { data: { assets: AssetCard[]; submitters: Submitter[]; total: number; page: number; pageSize: number } }
interface SessionResponse { data: { authenticated: boolean; user?: { role: string; email?: string; figmaHandle?: string | null; avatarUrl?: string | null; workspace?: { name: string } | null } } }
interface BoardSummary {
  id: string
  title: string
  purpose: 'showcase' | 'review' | 'portfolio' | 'case'
  itemCount: number
  assetIds: string[]
  previewAssets: AssetCard[]
}
interface BoardList { data: { collections: BoardSummary[] } }
interface BoardContent { data: { assets: AssetCard[] } }

type DateRange = 'all'|'today'|'week'|'two-weeks'|'month'|'custom'
const dateRanges: DateRange[] = ['all','today','week','two-weeks','month','custom']
const sortValues = ['newest','oldest','updated','title','dimensions','submitter']
const firstQueryValue = (value: unknown) => typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : ''
const listQueryValues = (value: unknown) => (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).flatMap(item => typeof item === 'string' ? item.split(',') : []).filter(Boolean)
const readFilterQuery = () => {
  const requestedDateRange = firstQueryValue(route.query.dateRange)
  const requestedSort = firstQueryValue(route.query.sort)
  const requestedStatus = firstQueryValue(route.query.status)
  return {
    search: firstQueryValue(route.query.search),
    status: ['approved','draft'].includes(requestedStatus) ? requestedStatus : '',
    projectIds: listQueryValues(route.query.projectIds),
    tagIds: listQueryValues(route.query.tagIds),
    uploadedBy: firstQueryValue(route.query.uploadedBy),
    dateRange: (dateRanges.includes(requestedDateRange as DateRange) ? requestedDateRange : 'all') as DateRange,
    dateFrom: firstQueryValue(route.query.dateFrom),
    dateTo: firstQueryValue(route.query.dateTo),
    sort: sortValues.includes(requestedSort) ? requestedSort : 'newest'
  }
}
const initialFilters = readFilterQuery()
const search = ref(initialFilters.search)
const status = ref(initialFilters.status)
const projectIds = ref<string[]>(initialFilters.projectIds)
const tagIds = ref<string[]>(initialFilters.tagIds)
const uploadedBy = ref(initialFilters.uploadedBy)
const dateRange = ref<DateRange>(initialFilters.dateRange)
const customDateFrom = ref(initialFilters.dateFrom)
const customDateTo = ref(initialFilters.dateTo)
const sort = ref(initialFilters.sort)
const filtersExpanded = ref(false)
const compactFiltersVisible = ref(true)
const filtersMorphing = ref(false)
const searchExpanded = ref(false)
const page = ref(1)
const replaceLibraryQuery = (changes: Record<string, string | undefined>) => {
  const nextQuery = { ...route.query }
  for (const [key,value] of Object.entries(changes)) {
    if (value) nextQuery[key] = value
    else delete nextQuery[key]
  }
  return router.replace({ path: '/library', query: nextQuery })
}
const persistedFilterQuery = computed(() => ({
  search: search.value || undefined,
  status: status.value || undefined,
  projectIds: projectIds.value.length ? projectIds.value.join(',') : undefined,
  tagIds: tagIds.value.length ? tagIds.value.join(',') : undefined,
  uploadedBy: uploadedBy.value || undefined,
  dateRange: dateRange.value !== 'all' ? dateRange.value : undefined,
  dateFrom: dateRange.value === 'custom' ? customDateFrom.value || undefined : undefined,
  dateTo: dateRange.value === 'custom' ? customDateTo.value || undefined : undefined,
  sort: sort.value !== 'newest' ? sort.value : undefined
}))
const dateFrom = computed(() => {
  if (dateRange.value === 'custom') return customDateFrom.value ? new Date(`${customDateFrom.value}T00:00:00`).toISOString() : ''
  const date = new Date()
  if (dateRange.value === 'today') date.setHours(0,0,0,0)
  else if (dateRange.value === 'week') { date.setDate(date.getDate()-((date.getDay()+6)%7)); date.setHours(0,0,0,0) }
  else if (dateRange.value === 'two-weeks') { date.setDate(date.getDate()-13); date.setHours(0,0,0,0) }
  else if (dateRange.value === 'month') { date.setDate(1); date.setHours(0,0,0,0) }
  else return ''
  return date.toISOString()
})
const dateTo = computed(() => dateRange.value === 'custom' && customDateTo.value ? new Date(`${customDateTo.value}T23:59:59.999`).toISOString() : '')
const query = computed(() => ({ search: search.value, ...(status.value ? { status: status.value } : {}), ...(projectIds.value.length ? { projectIds: projectIds.value.join(',') } : {}), ...(tagIds.value.length ? { tagIds: tagIds.value.join(',') } : {}), ...(uploadedBy.value ? { uploadedBy: uploadedBy.value } : {}), ...(dateFrom.value ? { dateFrom: dateFrom.value } : {}), ...(dateTo.value ? { dateTo: dateTo.value } : {}), sort: sort.value, page: page.value }))
const { data, status: loadStatus, error, refresh } = await useFetch<AssetList>('/api/assets', { query, watch: [query] })
const { data: projectData } = await useFetch<{data:{projects:Project[]}}>('/api/projects')
const { data: tagData } = await useFetch<{data:{tags:Tag[]}}>('/api/tags')
const { data: boardData, refresh: refreshBoards } = await useFetch<BoardList>('/api/shares')
const boardCreator = ref<{ openCreate: () => Promise<void>; openCreateFromCurrentView: () => Promise<void> }>()
const projects = computed(() => projectData.value?.data.projects ?? [])
const tags = computed(() => tagData.value?.data.tags ?? [])
const boards = computed(() => boardData.value?.data.collections.filter(board => board.purpose !== 'case') ?? [])
const selectedBoardId = computed(() => typeof route.query.board === 'string' ? route.query.board : '')
const selectedBoard = computed(() => boards.value.find(board => board.id === selectedBoardId.value))
const { data: selectedBoardData, status: selectedBoardStatus, error: selectedBoardError } = await useAsyncData('library-selected-board', async () => {
  const boardId = selectedBoardId.value
  if (!boardId) return { boardId: '', assets: [] as AssetCard[] }
  const board = boardData.value?.data.collections.find(collection => collection.id === boardId)
  const availableAssets = data.value?.data.assets ?? []
  const availableById = new Map(availableAssets.map(asset => [asset.id, asset]))
  const localAssets = (board?.assetIds ?? []).map(id => availableById.get(id)).filter((asset): asset is AssetCard => Boolean(asset))
  if (board && localAssets.length === board.assetIds.length) return { boardId, assets: localAssets }
  const response = await $fetch<BoardContent>(`/api/shares/${boardId}/content`)
  return { boardId, assets: response.data.assets }
}, { watch: [selectedBoardId] })
const locallyKnownBoardAssets = computed(() => {
  const board = selectedBoard.value
  if (!board) return []
  const availableById = new Map(assets.value.map(asset => [asset.id, asset]))
  const previewById = new Map(board.previewAssets.map(asset => [asset.id, asset]))
  return board.assetIds.map(id => availableById.get(id) ?? previewById.get(id)).filter((asset): asset is AssetCard => Boolean(asset))
})
const boardAssets = computed(() => {
  if (selectedBoardData.value?.boardId !== selectedBoardId.value) return locallyKnownBoardAssets.value
  const knownById = new Map(locallyKnownBoardAssets.value.map(asset => [asset.id, asset]))
  return selectedBoardData.value.assets.map(asset => {
    const known = knownById.get(asset.id)
    return known ? { ...asset, previewUrl: known.previewUrl, preview2xUrl: known.preview2xUrl ?? asset.preview2xUrl } : asset
  })
})
const displayedAssets = computed(() => {
  const source = selectedBoardId.value ? boardAssets.value : assets.value
  const term = search.value.trim().toLocaleLowerCase()
  return selectedBoardId.value && term
    ? source.filter(asset => `${asset.title} ${asset.description ?? ''}`.toLocaleLowerCase().includes(term))
    : source
})
const cardsHidden = ref(false)
let boardTransition = 0
const selectBoard = async (boardId: string) => {
  if (boardId === selectedBoardId.value) return
  const transition = ++boardTransition
  cardsHidden.value = true
  await new Promise(resolve => setTimeout(resolve, 300))
  if (transition !== boardTransition) return
  await replaceLibraryQuery({ board: boardId || undefined, asset: undefined })
  await nextTick()
  document.querySelector<HTMLElement>('.board-tabs button[aria-pressed="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  requestAnimationFrame(() => {
    if (transition === boardTransition) cardsHidden.value = false
  })
}
let boardSwipeStartX = 0
let boardSwipeStartY = 0
const boardSequence = computed(() => ['', ...boards.value.map(board => board.id)])
const startBoardSwipe = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return
  boardSwipeStartX = touch.clientX
  boardSwipeStartY = touch.clientY
}
const finishBoardSwipe = (event: TouchEvent) => {
  const touch = event.changedTouches[0]
  if (!touch || cardsHidden.value) return
  const deltaX = touch.clientX - boardSwipeStartX
  const deltaY = touch.clientY - boardSwipeStartY
  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return
  const currentIndex = Math.max(0, boardSequence.value.indexOf(selectedBoardId.value))
  const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1)
  const boardId = boardSequence.value[nextIndex]
  if (boardId !== undefined) void selectBoard(boardId)
}
const selectedProjectNames = computed(() => projects.value.filter(project => projectIds.value.includes(project.id)).map(project => project.name))
const selectedTagNames = computed(() => tags.value.filter(tag => tagIds.value.includes(tag.id)).map(tag => tag.name))
const dateRangeLabel = computed(() => dateRange.value === 'today' ? 'Today' : dateRange.value === 'week' ? 'This week' : dateRange.value === 'two-weeks' ? 'Last two weeks' : dateRange.value === 'month' ? 'This month' : dateRange.value === 'custom' ? 'Custom dates' : '')
const currentBoardFilters = computed(() => ({
  search: search.value.trim(),
  projectIds: projectIds.value,
  projectNames: selectedProjectNames.value,
  tagIds: tagIds.value,
  tagNames: selectedTagNames.value,
  uploadedBy: uploadedBy.value || null,
  dateFrom: dateFrom.value,
  dateTo: dateTo.value || (dateRange.value !== 'all' ? new Date().toISOString() : ''),
  dateLabel: dateRangeLabel.value,
  status: status.value
}))
const hasFilters = computed(() => Boolean(search.value || status.value || projectIds.value.length || tagIds.value.length || uploadedBy.value || dateRange.value !== 'all'))
const activeFilterCount = computed(() => [status.value, projectIds.value.length, tagIds.value.length, uploadedBy.value, dateRange.value !== 'all'].filter(Boolean).length)
const clearFilters = () => {
  search.value = ''
  status.value = ''
  projectIds.value = []
  tagIds.value = []
  uploadedBy.value = ''
  dateRange.value = 'all'
  customDateFrom.value = ''
  customDateTo.value = ''
}
const supportsFilterMorph = () => import.meta.client && 'startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
const morphFilters = async (update: () => void, direction: 'opening'|'closing', keepMorphMode = false) => {
  const viewTransitionDocument = document as Document & { startViewTransition: (callback: () => Promise<void>) => { finished: Promise<void> } }
  filtersMorphing.value = true
  document.documentElement.dataset.filterTransition = direction
  const transition = viewTransitionDocument.startViewTransition(async () => { update(); await nextTick() })
  try { await transition.finished } finally {
    delete document.documentElement.dataset.filterTransition
    if (!keepMorphMode) filtersMorphing.value = false
  }
}
const openFilters = () => {
  const update = () => { compactFiltersVisible.value = false; searchExpanded.value = false; filtersExpanded.value = true }
  if (supportsFilterMorph()) void morphFilters(update, 'opening', true)
  else update()
}
const closeFilters = () => {
  if (supportsFilterMorph()) void morphFilters(() => { filtersExpanded.value = false; compactFiltersVisible.value = true }, 'closing')
  else filtersExpanded.value = false
}
const finishFiltersClose = () => {
  if (!filtersExpanded.value) compactFiltersVisible.value = true
}
const assets = ref<AssetCard[]>([])
let liveRefreshTimer: ReturnType<typeof setTimeout> | undefined
let assetPollTimer: ReturnType<typeof setInterval> | undefined
let assetEvents: EventSource | undefined
watch(() => data.value?.data.assets, (next) => {
  const incoming = next ?? []
  if (incoming.map(asset => `${asset.id}:${asset.updated_at}`).join('|') === assets.value.map(asset => `${asset.id}:${asset.updated_at}`).join('|')) return
  assets.value = incoming
}, { immediate: true })
const submitters = computed(() => data.value?.data.submitters ?? [])
const visibleSubmitters = computed(() => submitters.value.slice(0, 5))
const submitterName = (submitter: Submitter) => submitter.figma_handle || 'Unknown submitter'
const submitterInitial = (submitter: Submitter) => submitterName(submitter).trim().charAt(0).toUpperCase() || '?'
const toggleSubmitter = (submitterId: string) => { uploadedBy.value = uploadedBy.value === submitterId ? '' : submitterId }
const total = computed(() => data.value?.data.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / 24)))
const resultMessage = computed(() => {
  if (selectedBoardId.value) return selectedBoardStatus.value === 'success' ? `${displayedAssets.value.length} ${displayedAssets.value.length === 1 ? 'asset' : 'assets'} in ${selectedBoard.value?.title ?? 'board'}` : ''
  return loadStatus.value === 'success' ? `${total.value} ${total.value === 1 ? 'asset' : 'assets'}` : ''
})
const { data: session } = await useFetch<SessionResponse>('/api/auth/session')
const accountName = computed(() => session.value?.data.user?.figmaHandle || session.value?.data.user?.email || 'Account')
const accountInitial = computed(() => accountName.value.trim().charAt(0).toUpperCase() || '?')
const isAdmin = computed(() => session.value?.data?.user?.role === 'admin')
const canManageProjects = computed(() => ['editor', 'admin'].includes(session.value?.data?.user?.role ?? ''))
const canShare = computed(() => ['contributor', 'editor', 'admin'].includes(session.value?.data?.user?.role ?? ''))
const selectedAssetId = computed(() => typeof route.query.asset === 'string' ? route.query.asset : '')
const selectedAssetPreviewUrl = computed(() => {
  const selected = displayedAssets.value.find(asset => asset.id === selectedAssetId.value)
  return selected?.preview2xUrl ?? selected?.previewUrl ?? ''
})
const assetPreviewUrls = computed(() => Object.fromEntries(displayedAssets.value.map(asset => [asset.id, asset.preview2xUrl ?? asset.previewUrl])))
const closeAsset = () => replaceLibraryQuery({ asset: undefined })
const navigateAsset = (id: string) => router.replace({ path: '/library', query: { ...route.query, asset: id } })
const handleAssetDeleted = (id: string) => {
  assets.value = assets.value.filter(asset => asset.id !== id)
  if (data.value) {
    data.value.data.assets = data.value.data.assets.filter(asset => asset.id !== id)
    data.value.data.total = Math.max(0, data.value.data.total - 1)
  }
  if (page.value > 1 && assets.value.length === 0) page.value--
  void refresh()
}
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
const refreshWhenVisible = () => {
  if (document.visibilityState === 'visible') void refresh()
}
watch([search, status, projectIds, tagIds, uploadedBy, dateRange, customDateFrom, customDateTo, sort], () => {
  page.value = 1
  void replaceLibraryQuery(persistedFilterQuery.value)
}, { deep: true })
watch(() => route.query, () => {
  const next = readFilterQuery()
  search.value = next.search
  status.value = next.status
  if (projectIds.value.join(',') !== next.projectIds.join(',')) projectIds.value = next.projectIds
  if (tagIds.value.join(',') !== next.tagIds.join(',')) tagIds.value = next.tagIds
  uploadedBy.value = next.uploadedBy
  dateRange.value = next.dateRange
  customDateFrom.value = next.dateFrom
  customDateTo.value = next.dateTo
  sort.value = next.sort
}, { deep: true })
onMounted(() => {
  lastScrollY = window.scrollY
  window.addEventListener('scroll', updateToolbar, { passive: true })
  assetEvents = new EventSource('/api/live/assets')
  assetEvents.addEventListener('assets-changed', () => {
    clearTimeout(liveRefreshTimer)
    liveRefreshTimer = setTimeout(() => { void refresh() }, 400)
  })
  assetEvents.addEventListener('ready', () => { void refresh() })
  assetPollTimer = setInterval(refreshWhenVisible, 15_000)
  window.addEventListener('focus', refreshWhenVisible)
  document.addEventListener('visibilitychange', refreshWhenVisible)
})
onBeforeUnmount(() => {
  clearTimeout(liveRefreshTimer)
  clearInterval(assetPollTimer)
  assetEvents?.close()
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('scroll', updateToolbar)
  window.removeEventListener('focus', refreshWhenVisible)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
})
</script>

<template>
  <div class="library-shell">
    <main id="main-content">
      <header class="index-toolbar" :class="{ 'toolbar-hidden': !toolbarVisible }">
        <div class="header-identity"><NuxtLink class="account-link" to="/account" :aria-label="`Open account for ${accountName}`" :title="accountName"><img v-if="session?.data.user?.avatarUrl" :src="session.data.user.avatarUrl" alt=""><span v-else aria-hidden="true">{{ accountInitial }}</span></NuxtLink><WorkspaceSwitcher class="brand" /></div>
        <form class="toolbar-search" role="search" @submit.prevent><label><span class="sr-only">Search assets</span><input v-model="search" type="search" name="search" placeholder="Search"></label></form>
        <p class="count sr-only" role="status" aria-live="polite">{{ resultMessage }}</p>
        <nav aria-label="Library controls"><NuxtLink class="button-secondary" to="/portfolio">Portfolio</NuxtLink><button v-if="canShare" class="button-secondary button-icon board-create-button" type="button" aria-label="Create board" title="Create board" @click="boardCreator?.openCreate()"><Plus :size="20" aria-hidden="true" /></button><ShareCollection ref="boardCreator" hide-trigger :current-filters="currentBoardFilters" @created="refreshBoards" /><NuxtLink v-if="isAdmin" class="button-secondary" to="/admin/users">Admin</NuxtLink><NuxtLink v-else-if="canManageProjects" class="button-secondary" to="/admin/projects">Projects</NuxtLink></nav>
      </header>

      <div v-if="boards.length" class="board-tabs-shell" :class="{ 'toolbar-hidden': !toolbarVisible }">
        <nav class="board-tabs" aria-label="Browse boards">
          <button type="button" :aria-pressed="!selectedBoardId" @click="selectBoard('')">All</button>
          <button v-for="board in boards" :key="board.id" type="button" :title="board.title" :aria-label="`Show ${board.title}`" :aria-pressed="selectedBoardId === board.id" @click="selectBoard(board.id)">{{ board.title }}</button>
        </nav>
      </div>

      <template v-if="!selectedBoardId">
        <SelectionPanel :visible="filtersExpanded" label="Asset filters" wide overlay raised :instant="filtersMorphing" @close="closeFilters" @after-leave="finishFiltersClose">
          <AssetFilterControls v-model:status="status" v-model:project-ids="projectIds" v-model:tag-ids="tagIds" v-model:date-range="dateRange" v-model:date-from="customDateFrom" v-model:date-to="customDateTo" v-model:sort="sort" :projects="projects" :tags="tags" heading="All assets" show-status use-date-presets show-sort expanded :actions-visible="hasFilters">
            <template #actions><button class="clear-filters-button" type="button" @click="clearFilters">Clear filters</button><button v-if="canShare" class="filter-create-board" type="button" @click="boardCreator?.openCreateFromCurrentView()">Create board</button></template>
            <div v-if="submitters.length" class="submitter-stack" role="group" aria-label="Filter by submitter"><button v-for="submitter in visibleSubmitters" :key="submitter.id" class="submitter-avatar" type="button" :aria-label="`Filter by ${submitterName(submitter)}`" :aria-pressed="uploadedBy === submitter.id" :title="submitterName(submitter)" @click="toggleSubmitter(submitter.id)"><img v-if="submitter.avatar_url" :src="submitter.avatar_url" alt=""><span v-else aria-hidden="true">{{ submitterInitial(submitter) }}</span></button><span v-if="submitters.length > visibleSubmitters.length" class="submitter-more" :title="`${submitters.length-visibleSubmitters.length} more submitters`">+{{ submitters.length-visibleSubmitters.length }}</span></div>
          </AssetFilterControls>
          <button class="filter-panel-toggle is-expanded" type="button" aria-label="Hide filters" aria-expanded="true" @click="closeFilters"><X :size="20" aria-hidden="true" /></button>
        </SelectionPanel>
        <SelectionPanel :visible="compactFiltersVisible && !filtersExpanded" label="Asset filters" :wide="searchExpanded" :bare="!searchExpanded" raised :instant="filtersMorphing">
          <Transition name="filter-controls"><form v-if="searchExpanded" class="mobile-search-form" role="search" @submit.prevent><label class="search-field"><span class="sr-only">Search assets</span><input v-model="search" type="search" name="filter-search" placeholder="Search" autofocus></label></form></Transition>
          <button class="filter-panel-toggle" type="button" aria-label="Show filters" aria-expanded="false" @click="openFilters"><span>Filters</span><span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span></button>
          <button v-if="hasFilters && !searchExpanded" class="filter-clear-compact" type="button" aria-label="Clear filters" title="Clear filters" @click="clearFilters"><X :size="16" aria-hidden="true" /></button>
          <button class="mobile-filter-search" :class="{ 'is-expanded': searchExpanded }" type="button" :aria-label="searchExpanded ? 'Hide search' : 'Search assets'" :aria-expanded="searchExpanded" @click="searchExpanded=!searchExpanded"><X v-if="searchExpanded" :size="20" aria-hidden="true" /><Search v-else :size="20" aria-hidden="true" /></button>
        </SelectionPanel>
      </template>
      <SelectionPanel v-else label="Board settings" bare raised><button class="filter-panel-toggle" type="button" @click="router.push(`/boards/${selectedBoardId}`)">Board settings</button></SelectionPanel>

      <div class="board-swipe-region" @touchstart.passive="startBoardSwipe" @touchend.passive="finishBoardSwipe">
        <span v-if="selectedBoardId && selectedBoardStatus === 'pending' && displayedAssets.length" class="sr-only" role="status">Loading the rest of {{ selectedBoard?.title ?? 'this board' }}</span>
        <AssetMasonrySkeleton v-if="selectedBoardId && selectedBoardStatus === 'pending' && displayedAssets.length === 0" :label="`Loading ${selectedBoard?.title ?? 'board'}`" />
        <div v-else-if="selectedBoardId && selectedBoardError && displayedAssets.length === 0" class="state error" role="alert"><strong>Unable to load this board.</strong><span>Try another board or return to all assets.</span></div>
        <AssetMasonrySkeleton v-else-if="!selectedBoardId && loadStatus === 'pending' && assets.length === 0" />
        <div v-else-if="!selectedBoardId && error" class="state error" role="alert"><strong>Unable to load assets.</strong><span>Check your connection and try again.</span><button type="button" @click="refresh()">Try again</button></div>
        <div v-else-if="displayedAssets.length === 0" class="state"><strong>{{ selectedBoardId ? 'No matching assets on this board' : hasFilters ? 'No matching assets' : 'No assets yet' }}</strong><span>{{ selectedBoardId ? 'Try another board or change your search.' : hasFilters ? 'Change your search or clear the filters.' : 'Upload frames from the Figma plugin to build this library.' }}</span><button v-if="!selectedBoardId && hasFilters" type="button" @click="clearFilters">Clear filters</button></div>
        <AssetMasonry v-else :assets="displayedAssets" :hidden="cardsHidden" :stable-columns="Boolean(selectedBoardId)" :animate-changes="!cardsHidden" interactive />
        <nav v-if="!selectedBoardId && totalPages > 1" class="pagination" aria-label="Pagination"><button :disabled="page === 1" @click="page--">Previous</button><span>Page {{ page }} of {{ totalPages }}</span><button :disabled="page === totalPages" @click="page++">Next</button></nav>
      </div>
    </main>
    <AssetOverlay v-if="selectedAssetId" :asset-id="selectedAssetId" :asset-ids="displayedAssets.map(asset => asset.id)" :preview-url="selectedAssetPreviewUrl" :preview-urls="assetPreviewUrls" @close="closeAsset" @deleted="handleAssetDeleted" @navigate="navigateAsset" />
  </div>
</template>

<style scoped>
.library-shell{--space:clamp(12px,1vw,24px);--muted:.45;min-height:100vh;color:#000;background:var(--color-bg);font-size:16px;font-weight:700;letter-spacing:-.015em;line-height:1.15}main{min-height:100vh;padding:var(--space);padding-bottom:calc(var(--space) + 68px)}.index-toolbar{position:sticky;z-index:4;top:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:start;gap:var(--space);min-height:68px;margin-top:calc(var(--space)*-1);padding:var(--space) 0;background:var(--color-bg)}.brand{text-decoration:none}.filters{width:100%;display:flex;flex-wrap:nowrap;gap:2px var(--space)}.filters label{min-width:7rem;flex:1}.filters input,.filters select{width:100%;min-height:24px;padding:0;border:0;border-bottom:1px solid rgb(0 0 0/.18);border-radius:0;color:inherit;background:transparent;font:inherit}.filters input::placeholder{color:inherit;opacity:var(--muted)}.count{margin:0;opacity:var(--muted);text-align:right;font-variant-numeric:tabular-nums}.index-toolbar nav{grid-column:4;position:absolute;top:calc(var(--space) + 27px);right:0;display:flex;gap:var(--space)}.index-toolbar nav a{text-decoration:none}.masonry{column-count:6;column-gap:var(--space)}.asset-card{display:inline-block;width:100%;break-inside:avoid;margin-bottom:calc(var(--space)*2);color:inherit;background:transparent;text-decoration:none}.preview{overflow:hidden;border-radius:8px;background:transparent;clip-path:inset(0 round 8px)}.preview img{display:block;width:100%;height:100%;object-fit:cover}.asset-card:hover{opacity:1}.card-body{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space);padding-top:8px}.card-body h2,.card-body p{margin:0;font:inherit}.card-body p,.card-body>span{opacity:.3}.card-body>span{text-transform:capitalize}.state{min-height:45vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--space)/3);padding:var(--space);text-align:center}.state strong{font-size:16px;line-height:1.15}.state span{font-size:14px;line-height:1.25;opacity:var(--muted)}.state button{min-height:36px;margin-top:calc(var(--space)/3);padding:0 calc(var(--space)*.75);font-size:13px;line-height:1}button{min-height:44px;padding:0 18px;border:0;border-radius:999px;color:white;background:black;font:inherit;cursor:pointer;transition-property:scale,opacity;transition-duration:150ms}.state button:active,.pagination button:active{scale:.96}.pagination{display:flex;align-items:center;justify-content:center;gap:var(--space);padding:calc(var(--space)*2) 0}.pagination span{opacity:var(--muted)}:is(a,button):focus-visible{outline:2px solid #06f90e;outline-offset:2px}.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}@media(max-width:2200px){.masonry{column-count:5}}@media(max-width:1680px){.masonry{column-count:4}}@media(max-width:1280px){.masonry{column-count:3}}@media(max-width:900px){.index-toolbar{grid-template-columns:1fr 2fr auto}.count{display:none}.masonry{column-count:2}}@media(max-width:520px){.index-toolbar{grid-template-columns:1fr auto;gap:8px}.brand{grid-column:1}.index-toolbar nav{position:static;grid-column:2;grid-row:1}.card-body{font-size:14px}.masonry{column-count:1}.state button{min-height:44px}}@media(prefers-reduced-motion:reduce){.preview img,button{transition:none}.state button:active,.pagination button:active{scale:1}}
.index-toolbar{transition:opacity .18s ease-out,transform .24s cubic-bezier(.2,0,0,1)}
.library-shell{--header-height:calc(44px + var(--space)*2)}
.board-tabs-shell{position:sticky;z-index:3;top:var(--header-height);margin:0 calc(var(--space)*-1) calc(var(--space)*2);overflow:hidden;background:var(--color-bg);transition:opacity .18s ease-out,transform .24s cubic-bezier(.2,0,0,1)}.board-tabs{display:flex;gap:var(--space);padding:0 var(--space);overflow-x:auto;overscroll-behavior-x:none;background:var(--color-bg);scrollbar-width:none}.board-tabs::-webkit-scrollbar{display:none}.board-tabs button{position:relative;min-height:44px;max-width:18ch;flex:0 0 auto;overflow:hidden;padding:0;color:inherit;background:transparent;border-radius:0;text-overflow:ellipsis;white-space:nowrap}.board-tabs button:first-child{max-width:none}.board-tabs button[aria-pressed=true]::after{content:"";position:absolute;right:0;bottom:4px;left:0;height:2px;background:currentColor}.board-tabs button:hover{opacity:.5}.board-tabs-shell.toolbar-hidden{pointer-events:none;opacity:0;transform:translateY(calc((var(--header-height) + 100%)*-1))}
.board-swipe-region{min-height:45vh;touch-action:pan-y}
.library-shell{--space:inherit}
@media(max-width:520px){.library-shell :deep(.asset-masonry .card-body p),.library-shell :deep(.asset-masonry .card-meta){display:none}}
.index-toolbar.toolbar-hidden{pointer-events:none;opacity:0;transform:translateY(calc(-100% - var(--space)))}
.index-toolbar{min-height:0}
.brand,.index-toolbar nav,.toolbar-search{min-height:44px;align-items:center}.brand{display:flex}
.index-toolbar nav{position:static;display:flex;justify-content:flex-end;gap:calc(var(--space)/2)}
.index-toolbar nav>.button-secondary{margin-left:0}
.header-identity{min-width:0;min-height:var(--control-height);display:flex;align-items:center;gap:calc(var(--space)/2)}
.board-create-button{width:calc(var(--control-height) - var(--space)/2);height:calc(var(--control-height) - var(--space)/2);min-width:calc(var(--control-height) - var(--space)/2);min-height:calc(var(--control-height) - var(--space)/2);padding:0;display:grid;place-items:center;border-radius:50%;color:var(--color-fg);background:var(--color-surface)}.board-create-button svg{fill:none;stroke:currentColor;stroke-width:1.8}
.account-link{width:calc(var(--control-height) - var(--space)/2);height:calc(var(--control-height) - var(--space)/2);flex:0 0 auto;display:grid;place-items:center;overflow:hidden;border-radius:50%;background:var(--color-surface)}.account-link img{display:block;width:100%;height:100%;object-fit:cover}.account-link:hover{opacity:1}
.mobile-filter-search{display:none}
.toolbar-search{grid-column:2/4;display:flex}.toolbar-search label{width:100%}.toolbar-search input{width:100%;height:44px;padding:0 8px}.toolbar-search input::-webkit-search-cancel-button{appearance:none}
.count{position:absolute}
.mobile-search-form{width:max-content;min-height:36px;display:flex;align-items:center}.mobile-search-form label{width:max-content;height:36px}.mobile-search-form input{box-sizing:border-box;width:auto;max-width:11rem;height:36px;min-height:36px;padding:0 14px;border:0;border-radius:999px;background:var(--color-surface);font-size:13px}.mobile-search-form input::-webkit-search-cancel-button{appearance:none}

.preview{position:relative}.preview-link{display:block;width:100%;height:100%}.preview-link:hover,.card-body a:hover{opacity:1}.card-body a{text-decoration:none}.figma-button{position:absolute;z-index:2;left:50%;bottom:12px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border-radius:999px;color:#fff;background:#000;text-decoration:none;white-space:nowrap;opacity:0;transform:translate(-50%,8px);pointer-events:none;transition-property:opacity,transform,scale;transition-duration:150ms;transition-timing-function:cubic-bezier(.2,0,0,1)}.asset-card:hover .figma-button,.asset-card:focus-within .figma-button{opacity:1;transform:translate(-50%,0);pointer-events:auto}.figma-button:hover{opacity:.8}.figma-button:active{scale:.96}.figma-button:focus-visible{outline:2px solid #06f90e;outline-offset:2px}
.figma-button{bottom:10px;min-height:32px;padding:0 13px;color:#000;background:#fff;font-size:12px;box-shadow:0 1px 3px rgb(0 0 0/.12)}
.filter-panel-toggle{display:flex;align-items:center;gap:8px;white-space:nowrap}.filter-panel-toggle:not(.is-expanded){min-height:44px;padding:0 20px;box-shadow:0 12px 36px rgb(0 0 0/.2)}.filter-panel-toggle.filter-panel-toggle.is-expanded{width:36px;padding:0;justify-content:center;box-shadow:none}.filter-panel-toggle svg{width:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}.filter-count{min-width:20px;height:20px;display:grid;place-items:center;padding:0 5px;border-radius:999px;color:var(--color-fg);background:var(--color-bg);font-size:11px}.filter-controls-enter-active,.filter-controls-leave-active{transition:opacity 140ms ease,transform 180ms cubic-bezier(.2,0,0,1)}.filter-controls-enter-from,.filter-controls-leave-to{opacity:0;transform:translateX(8px)}
.submitter-stack{min-width:max-content;height:36px;display:flex;align-items:center;padding-left:2px}.submitter-avatar,.submitter-more{width:36px;height:36px;min-width:36px;min-height:36px;display:grid;place-items:center;padding:0;border:2px solid var(--color-bg);border-radius:50%;overflow:hidden;background:var(--color-surface);font-size:11px}.submitter-avatar{position:relative}.submitter-avatar+.submitter-avatar,.submitter-more{margin-left:-8px}.submitter-avatar img{width:100%;height:100%;object-fit:cover}.submitter-avatar[aria-pressed=true]{z-index:2;box-shadow:0 0 0 2px currentColor}.submitter-avatar:hover{z-index:3;opacity:1;scale:1.08}.submitter-more{width:auto;min-width:36px;padding:0 7px;border-radius:999px;overflow:visible}
.filter-create-board{height:36px;min-height:36px;padding:0 var(--space);font-size:13px;white-space:nowrap}
.clear-filters-button{width:max-content;height:36px;min-width:0;min-height:36px;display:flex;align-items:center;justify-content:center;padding-inline:var(--space);color:var(--color-fg);background:var(--color-surface);white-space:nowrap}
@media(max-width:900px){.toolbar-search{grid-column:2}.index-toolbar nav{grid-column:3}}
@media(max-width:520px){
  .library-shell{--header-height:calc(44px + max(var(--space),env(safe-area-inset-top)) + var(--space))}
  .index-toolbar{grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:calc(var(--space)/2);margin:calc(var(--space)*-1) calc(var(--space)*-1) 0;padding:max(var(--space),env(safe-area-inset-top)) var(--space) var(--space)}
  .brand{min-width:0;overflow:hidden}
  .index-toolbar nav{min-width:0;grid-column:2;grid-row:1;justify-content:flex-start;gap:calc(var(--space)/2);overflow-x:auto;overscroll-behavior-inline:contain;scrollbar-width:none}
  .index-toolbar nav::-webkit-scrollbar{display:none}
  .toolbar-search{display:none}
  .mobile-filter-search.mobile-filter-search{width:44px;height:44px;min-height:44px;display:grid;place-items:center;padding:0;box-shadow:0 12px 36px rgb(0 0 0/.2)}
  .filter-panel-toggle:is(:hover,:active,:focus),.mobile-filter-search:is(:hover,:active,:focus){opacity:1}
  .mobile-filter-search svg{width:19px;fill:none;stroke:currentColor;stroke-width:2.1;stroke-linecap:round}
  .filter-panel-toggle.filter-panel-toggle.is-expanded{width:44px;height:44px;min-height:44px}
  .filter-panel-toggle svg{width:19px;stroke-width:2.1}
  .mobile-search-form~.filter-panel-toggle,.asset-filter-controls~.mobile-filter-search{display:none}
  .filter-create-board{height:44px;min-height:44px}
  .clear-filters-button{width:max-content;height:44px;min-width:0;min-height:44px}
  .mobile-search-form,.mobile-search-form label{width:100%;height:44px}
  .mobile-search-form label{flex:1 1 auto}
  .mobile-search-form input{width:100%;max-width:none;height:44px;min-height:44px;font-size:16px}
  .mobile-search-form input::placeholder{color:var(--color-muted);opacity:1}
  .mobile-search-form input:focus-visible{outline:0;box-shadow:none}
}
.preview{background:transparent}.preview.is-loading{background:var(--color-surface)}.preview img{opacity:0;transition:opacity .22s ease-out}.preview img.is-loaded{opacity:1}
.asset-card{opacity:1;transform:translateY(0);transition-property:opacity,transform;transition-duration:.18s,.22s;transition-delay:var(--card-stagger,0ms);transition-timing-function:ease-out,cubic-bezier(.2,0,0,1);animation:card-fade-in .42s cubic-bezier(.2,0,0,1) backwards;animation-delay:var(--card-stagger,0ms)}.masonry.cards-hidden .asset-card{opacity:0;transform:translateY(16px);transition-delay:0ms}@keyframes card-fade-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.result-swap-enter-active,.result-swap-leave-active{transition-property:opacity,transform;transition-duration:180ms;transition-timing-function:cubic-bezier(.2,0,0,1)}.result-swap-enter-from{opacity:0;transform:translateY(8px)}.result-swap-leave-to{opacity:0;transform:translateY(-4px)}
@media(prefers-reduced-motion:reduce){.index-toolbar,.board-tabs-shell,.filter-controls-enter-active,.filter-controls-leave-active,.result-swap-enter-active,.result-swap-leave-active{transition-duration:.01ms}.asset-card{transition:none;animation:none}.masonry.cards-hidden .asset-card{opacity:1;transform:none}.preview img{transition:none}.figma-button{transition-duration:.01ms;transform:translate(-50%,0)}.figma-button:active{scale:1}}
</style>
