<script setup lang="ts">
import { Gear2, Plus, Search, Xmark } from 'reicon-vue'
import type { BoardLayout, BoardViewSettings } from '@content-library/shared'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const router = useRouter()

interface AssetCard {
  id: string; title: string; description?: string | null; previewUrl: string; preview2xUrl?: string | null; originalUrl?: string | null; mime_type?: string | null; width: number; height: number; status?: string; figma_url?: string
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
  slug: string
  title: string
  purpose: 'showcase' | 'review' | 'portfolio' | 'case'
  publication_enabled: boolean
  itemCount: number
  assetIds: string[]
  previewAssets: AssetCard[]
  role: string
  mode: 'dynamic' | 'static'
  layout: BoardLayout
  filters: { search: string; projectId: string | null; tagId: string | null; projectIds: string[]; tagIds: string[]; uploadedBy: string | null; dateFrom: string | null; dateTo: string | null }
  view_settings?: BoardViewSettings | null
}
interface BoardMember { user_id: string; role: string; allowed_users: { email: string | null; figma_handle: string | null } | null }
interface BoardList { data: { collections: BoardSummary[] } }
interface BoardContent { data: { assets: AssetCard[] } }

type DateRange = 'all' | 'today' | 'week' | 'two-weeks' | 'month' | 'custom'
const dateRanges: DateRange[] = ['all', 'today', 'week', 'two-weeks', 'month', 'custom']
const sortValues = ['newest', 'oldest', 'updated', 'title', 'dimensions', 'submitter']
const firstQueryValue = (value: unknown) => typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : ''
const listQueryValues = (value: unknown) => (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).flatMap(item => typeof item === 'string' ? item.split(',') : []).filter(Boolean)
const readFilterQuery = () => {
  const requestedDateRange = firstQueryValue(route.query.dateRange)
  const requestedSort = firstQueryValue(route.query.sort)
  const requestedStatus = firstQueryValue(route.query.status)
  return {
    search: firstQueryValue(route.query.search),
    status: ['approved', 'draft'].includes(requestedStatus) ? requestedStatus : '',
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
const viewExpanded = ref(false)
const videoExpanded = ref(false)
const boardSettingsExpanded = ref(false)
const arrangeExpanded = ref(false)
const arrangeSelectedIds = ref<string[]>([])
const arrangeRemoving = ref(false)
const compactFiltersVisible = ref(true)
const filtersMorphing = ref(false)
const morphSource = ref<'filters' | 'view' | 'video' | 'settings' | null>(null)
const searchExpanded = ref(false)
const searchClosing = ref(false)
const page = ref(1)
const replaceLibraryQuery = (changes: Record<string, string | undefined>) => {
  const nextQuery = { ...route.query }
  for (const [key, value] of Object.entries(changes)) {
    if (value) nextQuery[key] = value
    else Reflect.deleteProperty(nextQuery, key)
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
  if (dateRange.value === 'today') date.setHours(0, 0, 0, 0)
  else if (dateRange.value === 'week') { date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); date.setHours(0, 0, 0, 0) }
  else if (dateRange.value === 'two-weeks') { date.setDate(date.getDate() - 13); date.setHours(0, 0, 0, 0) }
  else if (dateRange.value === 'month') { date.setDate(1); date.setHours(0, 0, 0, 0) }
  else return ''
  return date.toISOString()
})
const dateTo = computed(() => dateRange.value === 'custom' && customDateTo.value ? new Date(`${customDateTo.value}T23:59:59.999`).toISOString() : '')
const query = computed(() => ({ search: search.value, ...(status.value ? { status: status.value } : {}), ...(projectIds.value.length ? { projectIds: projectIds.value.join(',') } : {}), ...(tagIds.value.length ? { tagIds: tagIds.value.join(',') } : {}), ...(uploadedBy.value ? { uploadedBy: uploadedBy.value } : {}), ...(dateFrom.value ? { dateFrom: dateFrom.value } : {}), ...(dateTo.value ? { dateTo: dateTo.value } : {}), sort: sort.value, page: page.value }))
const { data, status: loadStatus, error, refresh } = await useLazyFetch<AssetList>('/api/assets', { query, watch: [query] })
const { data: projectData } = await useLazyFetch<{ data: { projects: Project[] } }>('/api/projects')
const { data: tagData } = await useLazyFetch<{ data: { tags: Tag[] } }>('/api/tags')
const { data: boardData, refresh: refreshBoards } = await useLazyFetch<BoardList>('/api/shares')
const boardCreator = ref<{ openCreate: () => Promise<void>; openCreateFromCurrentView: () => Promise<void> }>()
const projects = computed(() => projectData.value?.data.projects ?? [])
const tags = computed(() => tagData.value?.data.tags ?? [])
const boards = computed(() => boardData.value?.data.collections.filter(board => board.purpose !== 'case') ?? [])
const selectedBoardId = computed(() => typeof route.query.board === 'string' ? route.query.board : '')
const selectedBoard = computed(() => boards.value.find(board => board.id === selectedBoardId.value))
const selectedDynamicBoard = computed(() => selectedBoard.value?.mode === 'dynamic' ? selectedBoard.value : null)
const selectedStaticBoard = computed(() => selectedBoard.value?.mode === 'static' ? selectedBoard.value : null)
const canArrangeSelectedBoard = computed(() => Boolean(selectedStaticBoard.value && ['owner', 'editor', 'admin'].includes(selectedStaticBoard.value.role)))
const canRenameSelectedBoard = computed(() => Boolean(selectedBoard.value && ['owner', 'editor', 'admin'].includes(selectedBoard.value.role)))
const selectedBoardPublicUrl = computed(() => selectedBoard.value ? `/s/${selectedBoard.value.slug}` : '')
const canManageSelectedBoardMembers = computed(() => Boolean(selectedBoard.value && ['owner', 'admin'].includes(selectedBoard.value.role)))
const boardRenameBusy = ref(false)
const boardRenameFeedback = reactive({ text: '', error: false })
const boardSettingsBusy = ref(false)
const boardSettingsFeedback = reactive({ text: '', error: false })
const dismissBoardSettingsFeedback = () => {
  boardSettingsFeedback.text = ''
  boardSettingsFeedback.error = false
}
const boardMembers = ref<BoardMember[]>([])
const boardTitleDraft = ref('')
const boardTitleWords = computed(() => boardTitleDraft.value.trim().split(/\s+/).filter(Boolean))
const boardTitleInput = ref<HTMLTextAreaElement | null>(null)
const resizeSelectedBoardTitle = async () => {
  await nextTick()
  const input = boardTitleInput.value
  if (!input) return
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight}px`
}
const renameSelectedBoard = async (event: Event) => {
  const board = selectedBoard.value
  const input = event.target as HTMLInputElement
  if (!board || !canRenameSelectedBoard.value || boardRenameBusy.value) return
  const nextTitle = input.value.trim()
  if (!nextTitle) { boardTitleDraft.value = board.title; return }
  if (nextTitle === board.title) { boardTitleDraft.value = board.title; return }
  const previousTitle = board.title
  board.title = nextTitle
  boardRenameBusy.value = true
  boardRenameFeedback.text = ''
  boardRenameFeedback.error = false
  try {
    await $fetch(`/api/shares/${board.id}`, { method: 'PATCH', body: { action: 'rename', title: nextTitle } })
    if (selectedBoardId.value === board.id) boardRenameFeedback.text = 'Board name saved.'
  } catch {
    board.title = previousTitle
    boardTitleDraft.value = previousTitle
    if (selectedBoardId.value === board.id) {
      boardRenameFeedback.text = 'Unable to rename this board.'
      boardRenameFeedback.error = true
    }
  } finally {
    boardRenameBusy.value = false
  }
}
const handleBoardTitleKeydown = (event: KeyboardEvent) => {
  const input = event.currentTarget as HTMLInputElement
  if (event.key === 'Enter') { event.preventDefault(); input.blur() }
  if (event.key === 'Escape') { event.preventDefault(); boardTitleDraft.value = selectedBoard.value?.title ?? ''; input.blur() }
}
const setSelectedBoardPublication = async (enabled: boolean) => {
  const board = selectedBoard.value
  if (!board || !canRenameSelectedBoard.value || boardSettingsBusy.value || board.publication_enabled === enabled) return
  boardSettingsBusy.value = true
  boardSettingsFeedback.text = ''
  boardSettingsFeedback.error = false
  try {
    await $fetch(`/api/shares/${board.id}`, { method: 'PATCH', body: { action: enabled ? 'publish' : 'revoke' } })
    board.publication_enabled = enabled
    boardSettingsFeedback.text = enabled ? 'Board published.' : 'Board is now private.'
  } catch {
    boardSettingsFeedback.text = 'Unable to update public access.'
    boardSettingsFeedback.error = true
  } finally {
    boardSettingsBusy.value = false
  }
}
const copySelectedBoardLink = async () => {
  if (!selectedBoard.value) return
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${selectedBoardPublicUrl.value}`)
    boardSettingsFeedback.text = 'Public link copied.'
    boardSettingsFeedback.error = false
  } catch {
    boardSettingsFeedback.text = 'Unable to copy the public link.'
    boardSettingsFeedback.error = true
  }
}
const loadSelectedBoardMembers = async () => {
  const board = selectedBoard.value
  if (!board) return
  try {
    const response = await $fetch<{ data: { members: BoardMember[] } }>(`/api/shares/${board.id}/members`)
    if (selectedBoardId.value === board.id) boardMembers.value = response.data.members
  } catch {
    boardSettingsFeedback.text = 'Unable to load board members.'
    boardSettingsFeedback.error = true
  }
}
const setSelectedBoardLayout = async (layout: BoardLayout) => {
  const board = selectedBoard.value
  if (!board || !canRenameSelectedBoard.value || boardSettingsBusy.value || board.layout === layout) return
  const previous = board.layout
  board.layout = layout
  boardSettingsBusy.value = true
  try {
    await $fetch(`/api/shares/${board.id}`, { method: 'PATCH', body: { action: 'layout', layout } })
    boardSettingsFeedback.text = 'Public layout saved.'
    boardSettingsFeedback.error = false
  } catch {
    board.layout = previous
    boardSettingsFeedback.text = 'Unable to save the public layout.'
    boardSettingsFeedback.error = true
  } finally { boardSettingsBusy.value = false }
}
const saveSelectedBoardMember = async (email: string, role: 'editor' | 'contributor' | 'viewer') => {
  const board = selectedBoard.value
  if (!board || !canManageSelectedBoardMembers.value || boardSettingsBusy.value) return
  boardSettingsBusy.value = true
  try {
    await $fetch(`/api/shares/${board.id}/members`, { method: 'POST', body: { email, role } })
    await loadSelectedBoardMembers()
    boardSettingsFeedback.text = 'Board access saved.'
    boardSettingsFeedback.error = false
  } catch {
    boardSettingsFeedback.text = 'Unable to add this person. Add them to the workspace first.'
    boardSettingsFeedback.error = true
  } finally { boardSettingsBusy.value = false }
}
const removeSelectedBoardMember = async (userId: string) => {
  const board = selectedBoard.value
  if (!board || !canManageSelectedBoardMembers.value || boardSettingsBusy.value) return
  boardSettingsBusy.value = true
  try {
    await $fetch(`/api/shares/${board.id}/members/${userId}`, { method: 'DELETE' })
    await loadSelectedBoardMembers()
    boardSettingsFeedback.text = 'Board access removed.'
    boardSettingsFeedback.error = false
  } catch {
    boardSettingsFeedback.text = 'Unable to remove this board member.'
    boardSettingsFeedback.error = true
  } finally { boardSettingsBusy.value = false }
}
const deleteSelectedBoard = async () => {
  const board = selectedBoard.value
  if (!board || !canManageSelectedBoardMembers.value || boardSettingsBusy.value) return
  if (!window.confirm(`Delete “${board.title}”? This permanently removes its access and public link.`)) return
  boardSettingsBusy.value = true
  try {
    await $fetch(`/api/shares/${board.id}`, { method: 'DELETE' })
    boardSettingsExpanded.value = false
    await replaceLibraryQuery({ board: undefined, asset: undefined })
    await refreshBoards()
  } catch {
    boardSettingsFeedback.text = 'Unable to delete this board.'
    boardSettingsFeedback.error = true
  } finally { boardSettingsBusy.value = false }
}
const dynamicBoardFilters = reactive({ search: '', projectIds: [] as string[], tagIds: [] as string[], dateFrom: '', dateTo: '' })
const hydrateDynamicBoardFilters = (board: BoardSummary | null | undefined) => {
  const filters = board?.mode === 'dynamic' ? board.filters : null
  dynamicBoardFilters.search = filters?.search ?? ''
  dynamicBoardFilters.projectIds = [...(filters?.projectIds?.length ? filters.projectIds : filters?.projectId ? [filters.projectId] : [])]
  dynamicBoardFilters.tagIds = [...(filters?.tagIds?.length ? filters.tagIds : filters?.tagId ? [filters.tagId] : [])]
  dynamicBoardFilters.dateFrom = filters?.dateFrom?.slice(0, 10) ?? ''
  dynamicBoardFilters.dateTo = filters?.dateTo?.slice(0, 10) ?? ''
}
const defaultBoardView: BoardViewSettings = { showText: true, radius: 'default', gap: 'default', columns: 'auto' }
const libraryViewStorageKey = 'content-library:view-settings'
const libraryView = ref<BoardViewSettings>({ ...defaultBoardView })
const setLibraryView = (next: BoardViewSettings) => {
  libraryView.value = { ...next }
  if (import.meta.client) localStorage.setItem(libraryViewStorageKey, JSON.stringify(next))
}
const { data: selectedBoardData, status: selectedBoardStatus, error: selectedBoardError, refresh: refreshSelectedBoard } = await useAsyncData('library-selected-board', async () => {
  const boardId = selectedBoardId.value
  if (!boardId) return { boardId: '', assets: [] as AssetCard[] }
  const board = boardData.value?.data.collections.find(collection => collection.id === boardId)
  const availableAssets = data.value?.data.assets ?? []
  const availableById = new Map(availableAssets.map(asset => [asset.id, asset]))
  const localAssets = (board?.assetIds ?? []).map(id => availableById.get(id)).filter((asset): asset is AssetCard => Boolean(asset))
  if (board?.mode !== 'dynamic' && localAssets.length === board?.assetIds.length) return { boardId, assets: localAssets }
  const response = await $fetch<BoardContent>(`/api/shares/${boardId}/content`)
  return { boardId, assets: response.data.assets }
}, { watch: [selectedBoardId] })
let hydratingDynamicBoard = false
watch(selectedBoard, async board => {
  hydratingDynamicBoard = true
  hydrateDynamicBoardFilters(board)
  await nextTick()
  hydratingDynamicBoard = false
}, { immediate: true })
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
    return known ? {
      ...asset,
      previewUrl: known.previewUrl,
      preview2xUrl: known.preview2xUrl ?? asset.preview2xUrl,
      originalUrl: known.originalUrl ?? asset.originalUrl
    } : asset
  })
})
const displayedAssets = computed(() => {
  const source = selectedBoardId.value ? boardAssets.value : assets.value
  const term = search.value.trim().toLocaleLowerCase()
  return !selectedBoardId.value && term
    ? source.filter(asset => `${asset.title} ${asset.description ?? ''}`.toLocaleLowerCase().includes(term))
    : source
})
const cardsHidden = ref(false)
let boardTransition = 0
const selectBoard = async (boardId: string) => {
  if (boardId === selectedBoardId.value) return
  const transition = ++boardTransition
  viewExpanded.value = false
  videoExpanded.value = false
  boardSettingsExpanded.value = false
  arrangeExpanded.value = false
  filtersExpanded.value = false
  compactFiltersVisible.value = true
  searchExpanded.value = false
  searchClosing.value = false
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

let arrangeSaveTimer: ReturnType<typeof setTimeout> | undefined
let pendingArrangeSave: { boardId: string; assetIds: string[] } | undefined
let arrangeSaveQueue = Promise.resolve()
const flushArrangeSave = () => {
  clearTimeout(arrangeSaveTimer)
  arrangeSaveTimer = undefined
  const pending = pendingArrangeSave
  pendingArrangeSave = undefined
  if (!pending) return
  arrangeSaveQueue = arrangeSaveQueue.then(async () => {
    await $fetch(`/api/shares/${pending.boardId}/order`, { method: 'PATCH', body: { assetIds: pending.assetIds } })
  }).catch(async () => {
    if (selectedStaticBoard.value?.id === pending.boardId) await Promise.all([refreshSelectedBoard(), refreshBoards()])
  })
}
const reorderSelectedBoardAssets = (fromIndex: number, toIndex: number) => {
  const board = selectedStaticBoard.value
  if (!board || !canArrangeSelectedBoard.value || fromIndex === toIndex) return
  const nextAssets = [...boardAssets.value]
  const [moved] = nextAssets.splice(fromIndex, 1)
  if (!moved || toIndex < 0 || toIndex > nextAssets.length) return
  nextAssets.splice(toIndex, 0, moved)
  const nextIds = nextAssets.map(asset => asset.id)
  board.assetIds = nextIds
  if (selectedBoardData.value?.boardId === board.id) selectedBoardData.value.assets = nextAssets

  clearTimeout(arrangeSaveTimer)
  pendingArrangeSave = { boardId: board.id, assetIds: nextIds }
  arrangeSaveTimer = setTimeout(flushArrangeSave, 180)
}
const toggleArrangeSelection = (asset: AssetCard) => {
  arrangeSelectedIds.value = arrangeSelectedIds.value.includes(asset.id)
    ? arrangeSelectedIds.value.filter(id => id !== asset.id)
    : [...arrangeSelectedIds.value, asset.id]
}
const removeArrangeSelection = async () => {
  const board = selectedStaticBoard.value
  const selectedIds = arrangeSelectedIds.value.filter(id => board?.assetIds.includes(id))
  if (!board || !selectedIds.length || arrangeRemoving.value) return
  const subject = `${selectedIds.length} selected ${selectedIds.length === 1 ? 'item' : 'items'}`
  if (!window.confirm(`Remove ${subject} from ${board.title}?`)) return
  arrangeRemoving.value = true
  clearTimeout(arrangeSaveTimer)
  arrangeSaveTimer = undefined
  pendingArrangeSave = undefined
  try {
    await arrangeSaveQueue
    await Promise.all(selectedIds.map(assetId => $fetch(`/api/shares/${board.id}/assets/${assetId}`, { method: 'DELETE' })))
    const selectedSet = new Set(selectedIds)
    const nextAssets = boardAssets.value.filter(asset => !selectedSet.has(asset.id))
    board.assetIds = board.assetIds.filter(id => !selectedSet.has(id))
    if (selectedBoardData.value?.boardId === board.id) selectedBoardData.value.assets = nextAssets
    arrangeSelectedIds.value = []
    if (nextAssets.length) await $fetch(`/api/shares/${board.id}/order`, { method: 'PATCH', body: { assetIds: nextAssets.map(asset => asset.id) } })
    await refreshBoards()
  } catch {
    await Promise.all([refreshSelectedBoard(), refreshBoards()])
  } finally {
    arrangeRemoving.value = false
  }
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
  if (!touch || cardsHidden.value || arrangeExpanded.value) return
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
const dynamicBoardFilterCount = computed(() => [dynamicBoardFilters.search, dynamicBoardFilters.projectIds.length, dynamicBoardFilters.tagIds.length, dynamicBoardFilters.dateFrom || dynamicBoardFilters.dateTo].filter(Boolean).length)
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
const supportsFilterMorph = () => import.meta.client
  && window.matchMedia('(min-width: 761px)').matches
  && 'startViewTransition' in document
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
const morphPanel = async (panel: 'filters' | 'view' | 'video' | 'settings', update: () => void, direction: 'opening' | 'closing', keepMorphMode = false) => {
  const viewTransitionDocument = document as Document & { startViewTransition: (callback: () => Promise<void>) => { finished: Promise<void> } }
  filtersMorphing.value = true
  morphSource.value = panel
  await nextTick()
  document.documentElement.dataset.filterTransition = direction
  const transition = viewTransitionDocument.startViewTransition(async () => { update(); await nextTick() })
  try { await transition.finished } finally {
    delete document.documentElement.dataset.filterTransition
    morphSource.value = null
    if (!keepMorphMode) filtersMorphing.value = false
  }
}
const openFilters = () => {
  const update = () => { compactFiltersVisible.value = false; searchExpanded.value = false; viewExpanded.value = false; videoExpanded.value = false; boardSettingsExpanded.value = false; filtersExpanded.value = true }
  if (supportsFilterMorph()) void morphPanel('filters', update, 'opening', true)
  else update()
}
const closeFilters = () => {
  if (supportsFilterMorph()) void morphPanel('filters', () => { filtersExpanded.value = false; compactFiltersVisible.value = true }, 'closing')
  else filtersExpanded.value = false
}
const openView = () => {
  const update = () => { compactFiltersVisible.value = false; searchExpanded.value = false; filtersExpanded.value = false; videoExpanded.value = false; boardSettingsExpanded.value = false; viewExpanded.value = true }
  if (supportsFilterMorph()) void morphPanel('view', update, 'opening', true)
  else update()
}
const closeView = () => {
  const update = () => { viewExpanded.value = false }
  if (supportsFilterMorph()) void morphPanel('view', update, 'closing')
  else update()
}
const openVideo = () => {
  const update = () => { compactFiltersVisible.value = false; searchExpanded.value = false; filtersExpanded.value = false; viewExpanded.value = false; boardSettingsExpanded.value = false; videoExpanded.value = true }
  if (supportsFilterMorph()) void morphPanel('video', update, 'opening', true)
  else update()
}
const closeVideo = () => {
  const update = () => { videoExpanded.value = false }
  if (supportsFilterMorph()) void morphPanel('video', update, 'closing')
  else update()
}
const openBoardSettings = () => {
  boardSettingsFeedback.text = ''
  boardSettingsFeedback.error = false
  const update = () => { compactFiltersVisible.value = false; searchExpanded.value = false; filtersExpanded.value = false; viewExpanded.value = false; videoExpanded.value = false; boardSettingsExpanded.value = true }
  if (supportsFilterMorph()) void morphPanel('settings', update, 'opening', true)
  else update()
  void loadSelectedBoardMembers()
}
const closeBoardSettings = () => {
  const update = () => { boardSettingsExpanded.value = false }
  if (supportsFilterMorph()) void morphPanel('settings', update, 'closing')
  else update()
}
const finishExpandedPanelClose = () => {
  if (!filtersExpanded.value && !viewExpanded.value && !videoExpanded.value && !boardSettingsExpanded.value) compactFiltersVisible.value = true
}
watch([filtersExpanded, viewExpanded, videoExpanded, boardSettingsExpanded], (expanded) => {
  if (expanded.every(value => !value)) compactFiltersVisible.value = true
})
const toggleSearch = () => {
  if (searchExpanded.value) {
    searchClosing.value = true
    searchExpanded.value = false
    return
  }
  searchClosing.value = false
  searchExpanded.value = true
}
const finishSearchClose = () => { searchClosing.value = false }
const isoBoardDate = (value: string, end = false) => value ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`).toISOString() : null
let dynamicBoardSaveTimer: ReturnType<typeof setTimeout> | undefined
watch(() => [dynamicBoardFilters.search, dynamicBoardFilters.projectIds.join(','), dynamicBoardFilters.tagIds.join(','), dynamicBoardFilters.dateFrom, dynamicBoardFilters.dateTo], () => {
  if (!selectedDynamicBoard.value || hydratingDynamicBoard) return
  clearTimeout(dynamicBoardSaveTimer)
  dynamicBoardSaveTimer = setTimeout(async () => {
    const board = selectedDynamicBoard.value
    if (!board) return
    const filters = {
      search: dynamicBoardFilters.search, projectId: null, tagId: null,
      projectIds: dynamicBoardFilters.projectIds, tagIds: dynamicBoardFilters.tagIds,
      uploadedBy: board.filters.uploadedBy,
      dateFrom: isoBoardDate(dynamicBoardFilters.dateFrom), dateTo: isoBoardDate(dynamicBoardFilters.dateTo, true)
    }
    board.filters = filters
    try {
      await $fetch(`/api/shares/${board.id}`, { method: 'PATCH', body: { action: 'settings', filters } })
      await refreshSelectedBoard()
    } catch { hydrateDynamicBoardFilters(board) }
  }, 350)
})
const clearDynamicBoardFilters = () => {
  dynamicBoardFilters.search = ''
  dynamicBoardFilters.projectIds = []
  dynamicBoardFilters.tagIds = []
  dynamicBoardFilters.dateFrom = ''
  dynamicBoardFilters.dateTo = ''
}
const assets = ref<AssetCard[]>([])
const loadMoreSentinel = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | undefined
let liveRefreshTimer: ReturnType<typeof setTimeout> | undefined
let assetPollTimer: ReturnType<typeof setInterval> | undefined
let assetEvents: EventSource | undefined
watch(() => data.value?.data, (next) => {
  if (!next) return
  const incoming = next.assets ?? []
  if (next.page <= 1) {
    if (incoming.map(asset => `${asset.id}:${asset.updated_at}`).join('|') === assets.value.map(asset => `${asset.id}:${asset.updated_at}`).join('|')) return
    assets.value = incoming
    return
  }
  const merged = new Map(assets.value.map(asset => [asset.id, asset]))
  for (const asset of incoming) merged.set(asset.id, asset)
  assets.value = [...merged.values()]
}, { immediate: true })
const submitters = computed(() => data.value?.data.submitters ?? [])
const visibleSubmitters = computed(() => submitters.value.slice(0, 5))
const submitterName = (submitter: Submitter) => submitter.figma_handle || 'Unknown submitter'
const submitterInitial = (submitter: Submitter) => submitterName(submitter).trim().charAt(0).toUpperCase() || '?'
const toggleSubmitter = (submitterId: string) => { uploadedBy.value = uploadedBy.value === submitterId ? '' : submitterId }
const total = computed(() => data.value?.data.total ?? 0)
const canLoadMore = computed(() => !selectedBoardId.value && loadStatus.value !== 'pending' && assets.value.length < total.value)
const loadNextPage = () => {
  if (canLoadMore.value) page.value += 1
}
watch(loadMoreSentinel, (sentinel, previous) => {
  if (previous) loadMoreObserver?.unobserve(previous)
  if (sentinel) loadMoreObserver?.observe(sentinel)
})
const resultMessage = computed(() => {
  if (selectedBoardId.value) return selectedBoardStatus.value === 'success' ? `${displayedAssets.value.length} ${displayedAssets.value.length === 1 ? 'asset' : 'assets'} in ${selectedBoard.value?.title ?? 'board'}` : ''
  return loadStatus.value === 'success' ? `${total.value} ${total.value === 1 ? 'asset' : 'assets'}` : ''
})
const { data: session } = await useFetch<SessionResponse>('/api/auth/session')
const accountName = computed(() => session.value?.data.user?.figmaHandle || session.value?.data.user?.email || 'Account')
const accountInitial = computed(() => accountName.value.trim().charAt(0).toUpperCase() || '?')
const isAdmin = computed(() => session.value?.data?.user?.role === 'admin')
const canManageProjects = computed(() => ['editor', 'admin'].includes(session.value?.data?.user?.role ?? ''))
const canApprove = computed(() => ['editor', 'admin'].includes(session.value?.data?.user?.role ?? ''))
const canShare = computed(() => ['contributor', 'editor', 'admin'].includes(session.value?.data?.user?.role ?? ''))
const canRenameAssets = computed(() => ['editor', 'admin'].includes(session.value?.data?.user?.role ?? ''))
const assetRenameFeedback = ref('')
const setAssetTitle = (id: string, title: string) => {
  const update = (items: AssetCard[] | undefined) => {
    const asset = items?.find(item => item.id === id)
    if (asset) asset.title = title
  }
  update(assets.value)
  update(data.value?.data.assets)
  update(selectedBoardData.value?.assets)
  for (const board of boards.value) update(board.previewAssets)
}
const renameAsset = async (asset: AssetCard, title: string) => {
  title = toTitleCase(title)
  if (!canRenameAssets.value || !title || title === asset.title) return
  const previousTitle = asset.title
  assetRenameFeedback.value = ''
  setAssetTitle(asset.id, title)
  try {
    await $fetch(`/api/assets/${asset.id}`, { method: 'PATCH', body: { title } })
    assetRenameFeedback.value = `${title} saved.`
  } catch {
    setAssetTitle(asset.id, previousTitle)
    assetRenameFeedback.value = `Unable to rename ${previousTitle}.`
  }
}
const handleAssetRenamed = (id: string, title: string) => {
  setAssetTitle(id, title)
  assetRenameFeedback.value = `${title} saved.`
}
const toggleAssetApproval = async (asset: AssetCard) => {
  const previousStatus = asset.status
  asset.status = asset.status === 'approved' ? 'draft' : 'approved'
  try { await $fetch(`/api/assets/${asset.id}`, { method: 'PATCH', body: { status: asset.status } }) }
  catch { asset.status = previousStatus }
}
const selectedAssetId = computed(() => typeof route.query.asset === 'string' ? route.query.asset : '')
const selectedAssetPreviewUrl = computed(() => {
  const selected = displayedAssets.value.find(asset => asset.id === selectedAssetId.value)
  return selected?.previewUrl ?? ''
})
const assetPreviewUrls = computed(() => Object.fromEntries(displayedAssets.value.map(asset => [asset.id, asset.previewUrl])))
const closeAsset = () => replaceLibraryQuery({ asset: undefined })
const navigateAsset = (id: string) => router.replace({ path: '/library', query: { ...route.query, asset: id } })
const handleAssetDeleted = (id: string) => {
  assets.value = assets.value.filter(asset => asset.id !== id)
  if (data.value) {
    data.value.data.assets = data.value.data.assets.filter(asset => asset.id !== id)
    data.value.data.total = Math.max(0, data.value.data.total - 1)
  }
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
watch(() => [selectedBoardId.value, selectedBoard.value?.title] as const, ([, title]) => {
  boardTitleDraft.value = title ?? ''
}, { immediate: true })
watch(boardTitleDraft, () => { void resizeSelectedBoardTitle() })
watch([selectedBoardId, arrangeExpanded], ([, arranging]) => {
  boardRenameFeedback.text = ''
  boardRenameFeedback.error = false
  if (!arranging) {
    arrangeSelectedIds.value = []
    flushArrangeSave()
  }
})
onMounted(() => {
  try {
    const savedView = JSON.parse(localStorage.getItem(libraryViewStorageKey) ?? 'null') as Partial<BoardViewSettings> | null
    if (savedView) libraryView.value = { ...defaultBoardView, ...savedView }
  } catch { localStorage.removeItem(libraryViewStorageKey) }
  lastScrollY = window.scrollY
  window.addEventListener('resize', resizeSelectedBoardTitle)
  void resizeSelectedBoardTitle()
  void document.fonts.ready.then(resizeSelectedBoardTitle)
  window.addEventListener('scroll', updateToolbar, { passive: true })
  loadMoreObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadNextPage()
  }, { rootMargin: '800px 0px' })
  if (loadMoreSentinel.value) loadMoreObserver.observe(loadMoreSentinel.value)
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
  clearTimeout(dynamicBoardSaveTimer)
  flushArrangeSave()
  clearInterval(assetPollTimer)
  assetEvents?.close()
  loadMoreObserver?.disconnect()
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('resize', resizeSelectedBoardTitle)
  window.removeEventListener('scroll', updateToolbar)
  window.removeEventListener('focus', refreshWhenVisible)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
})
</script>

<template>
  <div class="library-shell">
    <main id="main-content">
      <header class="index-toolbar" :class="{ 'toolbar-hidden': !toolbarVisible }">
        <div class="header-identity">
          <NuxtLink class="account-link" to="/account" :aria-label="`Open account for ${accountName}`"
            :title="accountName"><img v-if="session?.data.user?.avatarUrl" :src="session.data.user.avatarUrl"
              alt=""><span v-else aria-hidden="true">{{ accountInitial }}</span></NuxtLink>
          <WorkspaceSwitcher class="brand" />
        </div>
        <p class="count sr-only" role="status" aria-live="polite">{{ resultMessage }}</p>
        <nav aria-label="Library controls">
          <NuxtLink class="button-secondary" to="/portfolio">Portfolio</NuxtLink><button v-if="canShare"
            class="button-secondary button-icon board-create-button" type="button" aria-label="Create board"
            title="Create board" @click="boardCreator?.openCreate()">
            <Plus :size="20" aria-hidden="true" />
          </button>
          <ShareCollection ref="boardCreator" hide-trigger :current-filters="currentBoardFilters"
            @created="refreshBoards" />
          <NuxtLink v-if="isAdmin" class="button-secondary" to="/admin/users">Admin</NuxtLink>
          <NuxtLink v-else-if="canManageProjects" class="button-secondary" to="/admin/projects">Projects</NuxtLink>
        </nav>
      </header>

      <div v-if="boards.length" class="board-tabs-shell" :class="{ 'toolbar-hidden': !toolbarVisible }">
        <nav class="board-tabs" aria-label="Browse boards">
          <button type="button" :aria-pressed="!selectedBoardId" @click="selectBoard('')">All</button>
          <button v-for="board in boards" :key="board.id" type="button"
            :title="`${board.title} · ${board.publication_enabled ? 'Published' : 'Private'}`"
            :aria-label="`Show ${board.title}, ${board.publication_enabled ? 'published' : 'private'}`"
            :aria-pressed="selectedBoardId === board.id" @click="selectBoard(board.id)"><span class="board-tab-status"
              :class="{ 'is-published': board.publication_enabled }" aria-hidden="true" /><span
              class="board-tab-title">{{ board.title }}</span></button>
        </nav>
      </div>

      <SelectionPanel :visible="viewExpanded" label="Library view" wide overlay raised :instant="filtersMorphing"
        @close="closeView" @after-leave="finishExpandedPanelClose">
        <BoardViewControls :model-value="libraryView" @update:model-value="setLibraryView" />
        <button class="filter-panel-toggle is-expanded" type="button" aria-label="Hide view settings"
          aria-expanded="true" @click="closeView">
          <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
        </button>
      </SelectionPanel>

      <SelectionPanel :visible="Boolean(selectedBoard && videoExpanded)" label="Create video" wide overlay raised
        :instant="filtersMorphing" @close="closeVideo" @after-leave="finishExpandedPanelClose">
        <BoardVideoComposer v-if="selectedBoard" :assets="displayedAssets" :board-title="selectedBoard.title" @close="closeVideo" />
        <button class="filter-panel-toggle is-expanded" type="button" aria-label="Close video creator"
          aria-expanded="true" @click="closeVideo">
          <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
        </button>
      </SelectionPanel>

      <SelectionPanel :visible="Boolean(selectedBoard && boardSettingsExpanded)" label="Board settings" wide overlay
        raised :instant="filtersMorphing" @close="closeBoardSettings" @after-leave="finishExpandedPanelClose">
        <BoardSettingsControls v-if="selectedBoard" :title="selectedBoard.title" :purpose="selectedBoard.purpose"
          :mode="selectedBoard.mode" :layout="selectedBoard.layout"
          :publication-enabled="selectedBoard.publication_enabled" :can-edit="canRenameSelectedBoard"
          :can-manage-members="canManageSelectedBoardMembers" :busy="boardSettingsBusy"
          :public-url="selectedBoardPublicUrl" :full-settings-url="`/boards/${selectedBoard.id}`"
          :members="boardMembers" :feedback="boardSettingsFeedback.text" :error="boardSettingsFeedback.error"
          @set-publication="setSelectedBoardPublication" @set-layout="setSelectedBoardLayout"
          @copy-link="copySelectedBoardLink" @save-member="saveSelectedBoardMember"
          @remove-member="removeSelectedBoardMember" @delete-board="deleteSelectedBoard"
          @dismiss-feedback="dismissBoardSettingsFeedback" />
        <button class="filter-panel-toggle is-expanded" type="button" aria-label="Hide board settings"
          aria-expanded="true" @click="closeBoardSettings">
          <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
        </button>
      </SelectionPanel>

      <template v-if="!selectedBoardId">
        <SelectionPanel :visible="filtersExpanded" label="Asset filters" wide overlay raised :instant="filtersMorphing"
          @close="closeFilters" @after-leave="finishExpandedPanelClose">
          <AssetFilterControls v-model:status="status" v-model:project-ids="projectIds" v-model:tag-ids="tagIds"
            v-model:date-range="dateRange" v-model:date-from="customDateFrom" v-model:date-to="customDateTo"
            v-model:sort="sort" :projects="projects" :tags="tags" heading="All assets" show-status use-date-presets
            show-sort expanded :actions-visible="hasFilters">
            <template #actions><button class="clear-filters-button" type="button" @click="clearFilters">Clear
                filters</button><button v-if="canShare" class="filter-create-board" type="button"
                @click="boardCreator?.openCreateFromCurrentView()">Create board</button></template>
            <div v-if="submitters.length" class="submitter-stack" role="group" aria-label="Filter by submitter"><button
                v-for="submitter in visibleSubmitters" :key="submitter.id" class="submitter-avatar" type="button"
                :aria-label="`Filter by ${submitterName(submitter)}`" :aria-pressed="uploadedBy === submitter.id"
                :title="submitterName(submitter)" @click="toggleSubmitter(submitter.id)"><img
                  v-if="submitter.avatar_url" :src="submitter.avatar_url" alt=""><span v-else aria-hidden="true">{{
                    submitterInitial(submitter)
                  }}</span></button><span v-if="submitters.length > visibleSubmitters.length" class="submitter-more"
                :title="`${submitters.length - visibleSubmitters.length} more submitters`">+{{
                  submitters.length -visibleSubmitters.length }}</span></div>
          </AssetFilterControls>
          <button class="filter-panel-toggle is-expanded" type="button" aria-label="Hide filters" aria-expanded="true"
            @click="closeFilters">
            <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
          </button>
        </SelectionPanel>
        <SelectionPanel
          :visible="compactFiltersVisible && !filtersExpanded && !viewExpanded && !videoExpanded && !boardSettingsExpanded"
          label="Asset filters" :wide="searchExpanded || searchClosing" bare raised :instant="filtersMorphing">
          <Transition name="compact-control">
            <div v-if="!searchExpanded && !searchClosing" class="mobile-control-blur"
              :class="{ 'is-morph-source': morphSource === 'filters' }"><button class="filter-panel-toggle"
                :class="{ 'has-filter-count': activeFilterCount }" type="button" aria-label="Show filters"
                aria-expanded="false" @click="openFilters"><span>Filters</span><span v-if="activeFilterCount"
                  class="filter-count">{{
                  activeFilterCount }}</span></button></div>
          </Transition>
          <Transition name="compact-control">
            <div v-if="!searchExpanded && !searchClosing" class="mobile-control-blur"
              :class="{ 'is-morph-source': morphSource === 'view' }"><button class="filter-panel-toggle" type="button"
                aria-label="Change library view" :aria-expanded="viewExpanded" @click="openView">View</button></div>
          </Transition>
          <Transition name="compact-control">
            <div v-if="hasFilters && !searchExpanded && !searchClosing" class="mobile-control-blur"><button
                class="mobile-filter-search is-expanded filter-clear-compact" type="button" aria-label="Clear filters"
                title="Clear filters" @click="clearFilters"><span class="search-control-icon search-control-icon--close"
                  aria-hidden="true">
                  <Xmark :size="20" :stroke-width="2" />
                </span></button></div>
          </Transition>
          <Transition name="filter-controls" @after-leave="finishSearchClose">
            <form v-if="searchExpanded" class="mobile-search-form" role="search" @submit.prevent><label
                class="search-field"><span class="sr-only">Search assets</span><input v-model="search" type="search"
                  name="filter-search" placeholder="Search" autofocus></label></form>
          </Transition>
          <div class="mobile-control-blur"><button class="mobile-filter-search"
              :class="{ 'is-expanded': searchExpanded || searchClosing }" type="button"
              :aria-label="searchExpanded ? 'Hide search' : 'Search assets'" :aria-expanded="searchExpanded"
              @click="toggleSearch"><span class="search-control-icon search-control-icon--search" aria-hidden="true">
                <Search :size="20" />
              </span><span class="search-control-icon search-control-icon--close" aria-hidden="true">
                <Xmark :size="20" :stroke-width="2" />
              </span></button></div>
        </SelectionPanel>
      </template>
      <template v-else>
        <SelectionPanel v-if="selectedDynamicBoard" :visible="filtersExpanded" label="Board asset filters" wide overlay
          raised :instant="filtersMorphing" @close="closeFilters" @after-leave="finishExpandedPanelClose">
          <AssetFilterControls v-model:search="dynamicBoardFilters.search"
            v-model:project-ids="dynamicBoardFilters.projectIds" v-model:tag-ids="dynamicBoardFilters.tagIds"
            v-model:date-from="dynamicBoardFilters.dateFrom" v-model:date-to="dynamicBoardFilters.dateTo"
            :projects="projects" :tags="tags" heading="Filters" show-search expanded
            :actions-visible="Boolean(dynamicBoardFilterCount)">
            <template #actions><button class="clear-filters-button" type="button"
                @click="clearDynamicBoardFilters">Clear filters</button></template>
          </AssetFilterControls>
          <button class="filter-panel-toggle is-expanded" type="button" aria-label="Hide filters" aria-expanded="true"
            @click="closeFilters">
            <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
          </button>
        </SelectionPanel>
      </template>

      <div class="board-swipe-region" @touchstart.passive="startBoardSwipe" @touchend.passive="finishBoardSwipe">
        <div v-if="selectedBoard" class="selected-board-heading" :class="{ 'title-hidden': cardsHidden }">
          <h1 class="selected-board-title"><textarea v-if="canRenameSelectedBoard" ref="boardTitleInput"
              v-model="boardTitleDraft" class="selected-board-title-input" rows="1" maxlength="120"
              aria-label="Board name" :disabled="boardRenameBusy" :aria-invalid="boardRenameFeedback.error || undefined"
              aria-describedby="selected-board-title-feedback" @change="renameSelectedBoard"
              @keydown="handleBoardTitleKeydown" /><span class="selected-board-title-display"
              :aria-hidden="canRenameSelectedBoard || undefined"><template v-for="(word, index) in boardTitleWords"
                :key="`${word}-${index}`"><span class="selected-board-title-word"
                  :style="{ '--word-stagger': `${Math.min(index * 18, 144)}ms` }">{{ word }}</span>{{ index <
                    boardTitleWords.length - 1 ? ' ' : '' }}</template></span>
          </h1>
          <div class="selected-board-subhead">
            <div class="selected-board-meta"><span>{{ selectedBoard.mode === 'dynamic' ? 'Dynamic board' : 'Static board' }} ·
                {{ selectedBoard.publication_enabled ? 'Public' : 'Private' }}</span><span
                id="selected-board-title-feedback" class="selected-board-title-feedback"
                :class="{ error: boardRenameFeedback.error }" role="status" aria-live="polite">{{
                boardRenameFeedback.text }}</span></div>
            <div class="selected-board-actions">
              <button v-if="selectedDynamicBoard" class="button-secondary selected-board-action-button"
                :class="{ 'is-morph-source': morphSource === 'filters', 'has-filter-count': dynamicBoardFilterCount }"
                type="button" aria-label="Show board filters" :aria-expanded="filtersExpanded"
                @click="openFilters"><span>Filters</span><span v-if="dynamicBoardFilterCount" class="filter-count">{{
                  dynamicBoardFilterCount }}</span></button>
              <button class="button-secondary selected-board-action-button"
                :class="{ 'is-morph-source': morphSource === 'view' }" type="button" aria-label="Change library view"
                :aria-expanded="viewExpanded" @click="openView">View</button>
              <button class="button-secondary selected-board-action-button"
                :class="{ 'is-morph-source': morphSource === 'video' }" type="button"
                aria-label="Create a video from this board" :aria-expanded="videoExpanded"
                @click="openVideo">Video</button>
              <button v-if="canArrangeSelectedBoard" class="button-secondary selected-board-action-button" type="button"
                :aria-pressed="arrangeExpanded" @click="arrangeExpanded = !arrangeExpanded">{{ arrangeExpanded ? 'Done'
                :
                'Arrange' }}</button>
              <button v-if="arrangeExpanded && arrangeSelectedIds.length"
                class="selected-board-action-button remove-selected-button" type="button" :disabled="arrangeRemoving"
                @click="removeArrangeSelection">Remove {{ arrangeSelectedIds.length }}</button>
              <button class="button-secondary selected-board-action-button selected-board-settings-button"
                :class="{ 'is-morph-source': morphSource === 'settings' }" type="button" aria-label="Board settings"
                title="Board settings" :aria-expanded="boardSettingsExpanded" @click="openBoardSettings">
                <Gear2 :size="20" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        <span v-if="selectedBoardId && selectedBoardStatus === 'pending' && displayedAssets.length" class="sr-only"
          role="status">Loading the rest of {{ selectedBoard?.title ?? 'this board' }}</span>
        <AssetMasonrySkeleton
          v-if="selectedBoardId && selectedBoardStatus === 'pending' && displayedAssets.length === 0"
          :label="`Loading ${selectedBoard?.title ?? 'board'}`" />
        <div v-else-if="selectedBoardId && selectedBoardError && displayedAssets.length === 0" class="state error"
          role="alert"><strong>Unable to load this board.</strong><span>Try another board or return to all
            assets.</span>
        </div>
        <AssetMasonrySkeleton v-else-if="!selectedBoardId && loadStatus === 'pending' && assets.length === 0" />
        <div v-else-if="!selectedBoardId && error" class="state error" role="alert"><strong>Unable to load
            assets.</strong><span>Check your connection and try again.</span><button type="button"
            @click="refresh()">Try
            again</button></div>
        <div v-else-if="displayedAssets.length === 0" class="state"><strong>{{ selectedBoardId ? 'No matching assets on this board' : hasFilters ? 'No matching assets' : 'No assets yet' }}</strong><span>{{ selectedBoardId ? 'Try another board or change your search.' : hasFilters ? 'Change your search or clear the filters.' : 'Upload frames from the Figma plugin to build this library.' }}</span><button v-if="!selectedBoardId && hasFilters" type="button"
            @click="clearFilters">Clear filters</button></div>
        <AssetMasonry v-else :key="selectedBoardId || 'all'" :assets="displayedAssets" :hidden="cardsHidden"
          :stable-columns="false" :animate-changes="!cardsHidden" :can-approve="canApprove && !arrangeExpanded"
          :editable-titles="canRenameAssets && !arrangeExpanded" :view-settings="libraryView"
          :interactive="!arrangeExpanded" :reorderable="arrangeExpanded" :selectable="arrangeExpanded"
          :selected-ids="arrangeSelectedIds" @reorder="reorderSelectedBoardAssets"
          @toggle-selection="toggleArrangeSelection" @toggle-approval="toggleAssetApproval" @rename="renameAsset" />
        <span class="sr-only" role="status" aria-live="polite">{{ assetRenameFeedback }}</span>
        <div v-if="canLoadMore" ref="loadMoreSentinel" class="load-more-sentinel" aria-hidden="true" />
        <span v-if="!selectedBoardId && loadStatus === 'pending' && assets.length" class="sr-only" role="status">Loading
          more
          assets</span>
      </div>
    </main>
    <AssetOverlay v-if="selectedAssetId" :asset-id="selectedAssetId" :asset-ids="displayedAssets.map(asset => asset.id)"
      :preview-url="selectedAssetPreviewUrl" :preview-urls="assetPreviewUrls" @close="closeAsset"
      @deleted="handleAssetDeleted" @navigate="navigateAsset" @renamed="handleAssetRenamed" />
  </div>
</template>

<style scoped>
.library-shell {
  --space: clamp(12px, 1vw, 24px);
  --muted: .45;
  min-height: 100vh;
  color: #000;
  background: var(--color-bg);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -.015em;
  line-height: 1.15
}

main {
  min-height: 100vh;
  padding: var(--space);
  padding-bottom: calc(var(--space) + 68px)
}

.index-toolbar {
  position: sticky;
  z-index: 4;
  top: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: start;
  gap: var(--space);
  min-height: 68px;
  margin-top: calc(var(--space)*-1);
  padding: var(--space) 0;
  background: var(--color-bg)
}

.brand {
  text-decoration: none
}

.filters {
  width: 100%;
  display: flex;
  flex-wrap: nowrap;
  gap: 2px var(--space)
}

.filters label {
  min-width: 7rem;
  flex: 1
}

.filters input,
.filters select {
  width: 100%;
  min-height: 24px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid rgb(0 0 0/.18);
  border-radius: 0;
  color: inherit;
  background: transparent;
  font: inherit
}

.filters input::placeholder {
  color: inherit;
  opacity: var(--muted)
}

.count {
  margin: 0;
  opacity: var(--muted);
  text-align: right;
  font-variant-numeric: tabular-nums
}

.index-toolbar nav {
  grid-column: 4;
  position: absolute;
  top: calc(var(--space) + 27px);
  right: 0;
  display: flex;
  gap: var(--space)
}

.index-toolbar nav a {
  text-decoration: none
}

.masonry {
  column-count: 6;
  column-gap: var(--space)
}

.asset-card {
  display: inline-block;
  width: 100%;
  break-inside: avoid;
  margin-bottom: calc(var(--space)*2);
  color: inherit;
  background: transparent;
  text-decoration: none
}

.preview {
  overflow: hidden;
  border-radius: 8px;
  background: transparent;
  clip-path: inset(0 round 8px)
}

.preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover
}

.asset-card:hover {
  opacity: 1
}

.card-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space);
  padding-top: 8px
}

.card-body h2,
.card-body p {
  margin: 0;
  font: inherit
}

.card-body p,
.card-body>span {
  opacity: .3
}

.card-body>span {
  text-transform: capitalize
}

.state {
  min-height: 45vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--space)/3);
  padding: var(--space);
  text-align: center
}

.state strong {
  font-size: 16px;
  line-height: 1.15
}

.state span {
  font-size: 14px;
  line-height: 1.25;
  opacity: var(--muted)
}

.state button {
  min-height: 36px;
  margin-top: calc(var(--space)/3);
  padding: 0 calc(var(--space)*.75);
  font-size: 13px;
  line-height: 1
}

button {
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  color: white;
  background: black;
  font: inherit;
  cursor: pointer;
  transition-property: scale, opacity;
  transition-duration: 150ms
}

.state button:active {
  scale: .96
}

.load-more-sentinel {
  height: 1px
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap
}

@media(max-width:2200px) {
  .masonry {
    column-count: 5
  }
}

@media(max-width:1680px) {
  .masonry {
    column-count: 4
  }
}

@media(max-width:1280px) {
  .masonry {
    column-count: 3
  }
}

@media(max-width:900px) {
  .index-toolbar {
    grid-template-columns: 1fr 2fr auto
  }

  .count {
    display: none
  }

  .masonry {
    column-count: 2
  }
}

@media(max-width:520px) {
  .index-toolbar {
    grid-template-columns: 1fr auto;
    gap: 8px
  }

  .brand {
    grid-column: 1
  }

  .index-toolbar nav {
    position: static;
    grid-column: 2;
    grid-row: 1
  }

  .card-body {
    font-size: 14px
  }

  .masonry {
    column-count: 1
  }

  .state button {
    min-height: 44px
  }
}

@media(prefers-reduced-motion:reduce) {

  .preview img,
  button {
    transition: none
  }

  .state button:active {
    scale: 1
  }
}

.index-toolbar {
  transition: opacity .18s ease-out, transform .24s cubic-bezier(.2, 0, 0, 1)
}

.library-shell {
  --header-height: calc(44px + var(--space)*2)
}

.board-tabs-shell {
  position: sticky;
  z-index: 3;
  top: var(--header-height);
  margin: 0 calc(var(--space)*-1) calc(var(--space)*1);
  overflow: hidden;
  background: var(--color-bg);
  transition: opacity .18s ease-out, transform .24s cubic-bezier(.2, 0, 0, 1)
}

.board-tabs {
  display: flex;
  gap: var(--space);
  padding: 0 var(--space);
  overflow-x: auto;
  overscroll-behavior-x: none;
  background: var(--color-bg);
  scrollbar-width: none
}

.board-tabs::-webkit-scrollbar {
  display: none
}

.board-tabs button {
  position: relative;
  min-height: 44px;
  max-width: 18ch;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 7px;
  overflow: hidden;
  padding: 0;
  color: inherit;
  background: transparent;
  border-radius: 0;
  white-space: nowrap
}

.board-tabs button:first-child {
  max-width: none
}

.board-tab-status {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border: 1px solid currentColor;
  border-radius: 50%;
  opacity: .45
}

.board-tab-status.is-published {
  border-color: #06f90e;
  background: #06f90e;
  opacity: 1
}

.board-tab-title {
  min-width: 0;
  margin-block: -.08em -.14em;
  padding-block: .08em .14em;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15
}

.board-tabs button[aria-pressed=true] {
  opacity: 1
}

.board-tabs button[aria-pressed=true]::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: 4px;
  left: 0;
  height: 2px;
  background: currentColor
}

.board-tabs-shell.toolbar-hidden {
  pointer-events: none;
  opacity: 0;
  transform: translateY(calc((var(--header-height) + 100%)*-1))
}

@media(hover:hover) and (pointer:fine) {
  .board-tabs button:not([aria-pressed=true]):hover {
    opacity: .5
  }
}

.board-swipe-region {
  min-height: 45vh;
  touch-action: pan-y
}

.selected-board-heading {
  margin: 0  calc(var(--space)*2) calc(var(--space)*2) 0
}

.selected-board-title {
  position: relative;
  margin: 0;
  font-size: clamp(2rem, 4vw, 4rem);
  font-weight: 700;
  letter-spacing: -.045em;
  line-height: 1;
  overflow-wrap: anywhere
}

.selected-board-title-display {
  display: block;
  min-height: 1em;
  padding-bottom: .08em
}

.selected-board-title-word {
  display: inline-block;
  opacity: 1;
  transform: translateY(0);
  transition-property: opacity, transform;
  transition-duration: .18s, .22s;
  transition-delay: var(--word-stagger, 0ms);
  transition-timing-function: ease-out, cubic-bezier(.2, 0, 0, 1)
}

.selected-board-heading.title-hidden .selected-board-title-word {
  opacity: 0;
  transform: translateY(16px);
  transition-delay: 0ms
}

.selected-board-title-input {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: 1em;
  padding: 0 0 .08em;
  overflow: hidden;
  resize: none;
  border: 0;
  border-bottom: 1px solid transparent;
  border-radius: 0;
  color: inherit;
  background: var(--color-bg);
  font: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  opacity: 0
}

.selected-board-title-input:focus {
  border-bottom-color: currentColor;
  outline: 0;
  opacity: 1
}

.selected-board-title:focus-within .selected-board-title-display {
  opacity: 0
}

.selected-board-title-input:disabled {
  opacity: .55
}

.selected-board-subhead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--space)/2) var(--space);
  margin-top: calc(var(--space)/2);
}

.selected-board-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
  opacity: 1;
  transform: translateY(0);
  transition: opacity .18s ease-out, transform .22s cubic-bezier(.2, 0, 0, 1)
}

.selected-board-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: calc(var(--space)/2)
}

.selected-board-action-button {
  --action-stagger: 0ms;
  flex: 0 0 auto;
  min-height: 36px;
  padding-inline: calc(var(--space)*.75);
  font-size: 13px;
  opacity: 1;
  transform: translateY(0);
  transition-property: opacity, transform, scale;
  transition-duration: 180ms, 220ms, 150ms;
  transition-delay: var(--action-stagger), var(--action-stagger), 0ms;
  transition-timing-function: ease-out, cubic-bezier(.2, 0, 0, 1), ease
}

.selected-board-action-button:nth-child(2) {
  --action-stagger: 35ms
}

.selected-board-action-button:nth-child(3) {
  --action-stagger: 70ms
}

.selected-board-action-button:nth-child(4) {
  --action-stagger: 105ms
}

.selected-board-settings-button {
  width: 36px;
  min-width: 36px;
  padding: 0;
  display: grid;
  place-items: center
}

.selected-board-settings-button svg {
  width: 18px;
  height: 18px
}

.selected-board-heading.title-hidden .selected-board-meta {
  opacity: 0;
  transform: translateY(16px)
}

.selected-board-heading.title-hidden .selected-board-action-button {
  pointer-events: none;
  opacity: 0;
  transform: translateY(6px);
  transition-delay: 0ms, 0ms, 0ms
}

.selected-board-title-feedback {
  opacity: .8
}

.selected-board-title-feedback:empty {
  display: none
}

.selected-board-title-feedback.error {
  color: var(--color-danger);
  opacity: 1
}

.library-shell {
  --space: inherit
}

@media(max-width:520px) {
  .selected-board-subhead {
    row-gap: var(--space)
  }

  .library-shell :deep(.asset-masonry .card-body p),
  .library-shell :deep(.asset-masonry .card-meta) {
    display: none
  }
}

.index-toolbar.toolbar-hidden {
  pointer-events: none;
  opacity: 0;
  transform: translateY(calc(-100% - var(--space)))
}

.index-toolbar {
  min-height: 0
}

.brand,
.index-toolbar nav {
  min-height: 44px;
  align-items: center
}

.brand {
  display: flex
}

.index-toolbar nav {
  position: static;
  display: flex;
  justify-content: flex-end;
  gap: calc(var(--space)/2)
}

.index-toolbar nav>.button-secondary {
  margin-left: 0
}

.header-identity {
  min-width: 0;
  min-height: var(--control-height);
  display: flex;
  align-items: center;
  gap: calc(var(--space)/2)
}

.board-create-button {
  width: calc(var(--control-height) - var(--space)/2);
  height: calc(var(--control-height) - var(--space)/2);
  min-width: calc(var(--control-height) - var(--space)/2);
  min-height: calc(var(--control-height) - var(--space)/2);
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-fg);
  background: var(--color-surface)
}

.board-create-button svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8
}

.account-link {
  width: calc(var(--control-height) - var(--space)/2);
  height: calc(var(--control-height) - var(--space)/2);
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-surface)
}

.account-link img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover
}

.account-link:hover {
  opacity: 1
}

.mobile-filter-search.mobile-filter-search {
  width: 44px;
  height: 44px;
  min-height: 44px;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--filter-overlay-panel-color);
  background: transparent;
  box-shadow: none
}

.search-control-icon {
  grid-area: 1/1;
  display: grid;
  place-items: center;
  opacity: 1;
  scale: 1;
  filter: blur(0);
  transition-property: opacity, scale, filter;
  transition-duration: 180ms;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1);
  pointer-events: none
}

.search-control-icon--close,
.mobile-filter-search.is-expanded .search-control-icon--search {
  opacity: 0;
  scale: .25;
  filter: blur(4px)
}

.mobile-filter-search.is-expanded .search-control-icon--close {
  opacity: 1;
  scale: 1;
  filter: blur(0)
}

.mobile-filter-search svg {
  width: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.1;
  stroke-linecap: round
}

.count {
  position: absolute
}

.mobile-search-form {
  width: 18rem;
  min-height: 44px;
  display: flex;
  align-items: center
}

.mobile-search-form label {
  width: 100%;
  height: 44px
}

.mobile-search-form input {
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  height: 44px;
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  color: var(--material-tinted-fg);
  background: var(--material-tinted-bg);
  font-size: 16px;
  backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));
  -webkit-backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation))
}

.mobile-search-form input::placeholder {
  color: rgb(255 255 255/.58);
  opacity: 1
}

.mobile-search-form input:focus-visible {
  outline: 0;
  box-shadow: none
}

.mobile-search-form input::-webkit-search-cancel-button {
  appearance: none
}

.mobile-search-form.filter-controls-enter-active,
.mobile-search-form.filter-controls-leave-active {
  overflow: hidden;
  transition-property: width, clip-path;
  transition-duration: 240ms;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1)
}

.mobile-search-form.filter-controls-enter-from,
.mobile-search-form.filter-controls-leave-to {
  width: 0;
  clip-path: inset(0 100% 0 0 round 999px);
  transform: none
}

.mobile-search-form.filter-controls-leave-active label {
  min-width: 18rem
}

.compact-control-leave-active {
  position: absolute;
  right: calc(var(--filter-control-height-mobile) + var(--filter-panel-control-gap));
  overflow: hidden;
  transform-origin: right center;
  transition-property: clip-path, transform;
  transition-duration: 240ms;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1)
}

.compact-control-leave-active:has(.filter-clear-compact) {
  right: calc(var(--filter-control-height-mobile)*2 + var(--filter-panel-control-gap)*2)
}

.compact-control-leave-to {
  clip-path: inset(0 0 0 100% round var(--filter-pill-radius));
  transform: translateX(4px) scaleX(.01)
}

.compact-control-enter-active {
  transition-property: clip-path, transform;
  transition-duration: 240ms;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1)
}

.compact-control-enter-from {
  clip-path: inset(0 100% 0 0 round var(--filter-pill-radius));
  transform: translateX(4px) scaleX(.01)
}

.preview {
  position: relative
}

.preview-link {
  display: block;
  width: 100%;
  height: 100%
}

.preview-link:hover,
.card-body a:hover {
  opacity: 1
}

.card-body a {
  text-decoration: none
}

.figma-button {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: 12px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  border-radius: 999px;
  color: #fff;
  background: #000;
  text-decoration: none;
  white-space: nowrap;
  opacity: 0;
  transform: translate(-50%, 8px);
  pointer-events: none;
  transition-property: opacity, transform, scale;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1)
}

.asset-card:hover .figma-button,
.asset-card:focus-within .figma-button {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto
}

.figma-button:hover {
  opacity: .8
}

.figma-button:active {
  scale: .96
}

.figma-button:focus-visible {
  outline: 2px solid #06f90e;
  outline-offset: 2px
}

.figma-button {
  bottom: 10px;
  min-height: 32px;
  padding: 0 13px;
  color: var(--material-tinted-fg);
  background: var(--material-tinted-bg);
  font-size: 12px;
  box-shadow: none;
  -webkit-backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation));
  backdrop-filter: blur(var(--material-tinted-blur)) saturate(var(--material-tinted-saturation))
}

.filter-panel-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap
}

.filter-panel-toggle:not(.is-expanded) {
  min-height: 44px;
  padding: 0 20px;
  box-shadow: none
}

.filter-panel-toggle.filter-panel-toggle.is-expanded {
  width: 36px;
  padding: 0;
  justify-content: center;
  box-shadow: none
}

.filter-panel-toggle svg {
  width: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round
}

.filter-count {
  min-width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  color: var(--color-fg);
  background: var(--color-bg);
  font-size: 11px
}

.filter-controls-enter-active,
.filter-controls-leave-active {
  transition-property: opacity, transform;
  transition-duration: 180ms, 220ms;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1)
}

.filter-controls-enter-from,
.filter-controls-leave-to {
  opacity: 0;
  transform: translateX(4px)
}

.board-settings-button.board-settings-button {
  width: 44px;
  min-width: 44px;
  padding: 0;
  justify-content: center
}

.board-settings-button.board-settings-button svg {
  width: 19px;
  height: 19px
}

.remove-selected-button.remove-selected-button {
  background: var(--color-danger)
}

.submitter-stack {
  min-width: max-content;
  display: flex;
  align-items: center;
  padding-left: 2px
}

.submitter-avatar,
.submitter-more {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 2px solid var(--color-bg);
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-surface);
  font-size: 11px
}

.submitter-avatar {
  position: relative
}

.submitter-avatar+.submitter-avatar,
.submitter-more {
  margin-left: -8px
}

.submitter-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover
}

.submitter-avatar[aria-pressed=true] {
  z-index: 2;
  box-shadow: 0 0 0 2px currentColor
}

.submitter-avatar:hover {
  z-index: 3;
  opacity: 1;
  scale: 1.08
}

.submitter-more {
  width: auto;
  min-width: 36px;
  padding: 0 7px;
  border-radius: 999px;
  overflow: visible
}

.filter-create-board {
  height: 36px;
  min-height: 36px;
  padding: 0 var(--space);
  font-size: 13px;
  white-space: nowrap
}

.clear-filters-button {
  width: max-content;
  height: 36px;
  min-width: 0;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-inline: var(--space);
  color: var(--color-fg);
  background: var(--color-surface);
  white-space: nowrap
}

@media(max-width:900px) {
  .index-toolbar nav {
    grid-column: 3
  }
}

@media(max-width:520px) {
  .library-shell {
    --header-height: calc(44px + max(var(--space), env(safe-area-inset-top)) + var(--space))
  }

  .index-toolbar {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    gap: calc(var(--space)/2);
    margin: calc(var(--space)*-1) calc(var(--space)*-1) 0;
    padding: max(var(--space), env(safe-area-inset-top)) var(--space) var(--space)
  }

  .brand {
    min-width: 0;
    overflow: visible
  }

  .index-toolbar nav {
    min-width: 0;
    grid-column: 2;
    grid-row: 1;
    justify-content: flex-start;
    gap: calc(var(--space)/2);
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: none
  }

  .index-toolbar nav::-webkit-scrollbar {
    display: none
  }

  .mobile-filter-search.mobile-filter-search {
    width: 44px;
    height: 44px;
    min-height: 44px
  }

  .filter-panel-toggle:is(:hover, :active, :focus),
  .mobile-filter-search:is(:hover, :active, :focus) {
    opacity: 1
  }

  .filter-panel-toggle.filter-panel-toggle.is-expanded {
    width: 44px;
    height: 44px;
    min-height: 44px
  }

  .filter-panel-toggle svg {
    width: 20px;
    height: 20px
  }

  .asset-filter-controls~.mobile-control-blur:has(.mobile-filter-search) {
    display: none
  }

  .filter-create-board {
    height: 44px;
    min-height: 44px
  }

  .clear-filters-button {
    width: max-content;
    height: 44px;
    min-width: 0;
    min-height: 44px
  }

  .mobile-search-form,
  .mobile-search-form label {
    width: 100%;
    height: 44px
  }

  .mobile-search-form label {
    flex: 1 1 auto
  }

  .mobile-search-form input {
    width: 100%;
    max-width: none
  }
}

.selected-board-title {
  width: 85%
}

.selected-board-title,
.selected-board-title-display {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  text-wrap: pretty
}

.selected-board-title-input {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  text-wrap: wrap
}

@media(max-width:720px) {
  .selected-board-title {
    width: 100%
  }
}

.preview {
  background: transparent
}

.preview.is-loading {
  background: var(--color-surface)
}

.preview img {
  opacity: 0;
  transition: opacity .22s ease-out
}

.preview img.is-loaded {
  opacity: 1
}

.asset-card {
  opacity: 1
}

.masonry.cards-hidden .asset-card {
  visibility: hidden
}

.result-swap-enter-active,
.result-swap-leave-active {
  transition-property: opacity, transform;
  transition-duration: 180ms;
  transition-timing-function: cubic-bezier(.2, 0, 0, 1)
}

.result-swap-enter-from {
  opacity: 0;
  transform: translateY(8px)
}

.result-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px)
}

.filter-panel-toggle.has-filter-count {
  gap: calc(var(--space)/3);
  padding-left: calc(var(--space)*1.25);
  padding-right: calc(var(--space)*.75)
}

.selected-board-action-button.has-filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--space)/3);
  padding-left: var(--space);
  padding-right: calc(var(--space)/2)
}

.selected-board-action-button.has-filter-count .filter-count {
  flex: 0 0 auto
}

@media(prefers-reduced-motion:reduce) {

  .index-toolbar,
  .board-tabs-shell,
  .filter-controls-enter-active,
  .filter-controls-leave-active,
  .result-swap-enter-active,
  .result-swap-leave-active,
  .search-control-icon {
    transition-duration: .01ms
  }

  .asset-card {
    transition: none;
    animation: none
  }

  .masonry.cards-hidden .asset-card,
  .selected-board-heading.title-hidden .selected-board-title-word,
  .selected-board-heading.title-hidden .selected-board-meta,
  .selected-board-heading.title-hidden .selected-board-action-button {
    opacity: 1;
    transform: none
  }

  .selected-board-title-word,
  .selected-board-meta,
  .selected-board-action-button {
    transition: none
  }

  .preview img {
    transition: none
  }

  .figma-button {
    transition-duration: .01ms;
    transform: translate(-50%, 0)
  }

  .figma-button:active {
    scale: 1
  }
}
</style>
