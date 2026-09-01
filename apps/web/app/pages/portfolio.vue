<script setup lang="ts">
import type { BoardLayout, BoardViewSettings } from '@content-library/shared'
import { MoreH } from 'reicon-vue'

definePageMeta({ middleware: 'auth' })

interface PreviewAsset {
  id: string
  title: string
  previewUrl: string
  mime_type?: string | null
  width: number
  height: number
}

interface Board {
  id: string
  slug: string
  title: string
  purpose: 'showcase' | 'review' | 'portfolio' | 'case'
  portfolio_kind: 'main' | 'client' | null
  publication_enabled: boolean
  role: 'owner' | 'editor' | 'contributor' | 'viewer' | 'admin'
  itemCount: number
  previewAssets: PreviewAsset[]
  portfolio_client: string | null
  introduction: string | null
  contact_heading: string | null
  contact_links: Array<{ label: string; url: string }> | null
  layout: BoardLayout
  view_settings: BoardViewSettings | null
}

interface PortfolioCaseSelection {
  caseId: string
  title: string | null
  description: string | null
  previewAssets?: PreviewAsset[]
}

interface PortfolioBoardsResponse {
  data: {
    selectedIds: string[]
    selectedCases: PortfolioCaseSelection[]
  }
}

interface PortfolioBoardPreviewsResponse {
  data: {
    previewAssets: PreviewAsset[]
  }
}

interface CreatePortfolioResponse {
  data: { collection: Board }
}

interface PortfolioCollectionsResponse {
  data: { collections: Board[] }
}

const apiFetch = useRequestFetch()
const route = useRoute()
const portfolioCollectionsCache = useState<PortfolioCollectionsResponse | null>('portfolio-collections-cache', () => null)
const { data: fetchedData, error, refresh: refreshCollections, status: collectionsStatus } = await useLazyFetch<PortfolioCollectionsResponse>('/api/shares', {
  query: { previews: 'false' },
  server: false,
  immediate: !portfolioCollectionsCache.value
})
watch(fetchedData, (value) => {
  if (value) portfolioCollectionsCache.value = value
}, { immediate: true })
const data = computed(() => portfolioCollectionsCache.value ?? fetchedData.value)
let boardPreviewsLoading = false
const loadBoardPreviews = async () => {
  if (!import.meta.client || boardPreviewsLoading || !data.value?.data.collections.some(board => board.itemCount > 0 && !board.previewAssets.length)) return
  boardPreviewsLoading = true
  try {
    const response = await apiFetch<PortfolioCollectionsResponse>('/api/shares', { query: { previews: 'true' } })
    const previews = new Map(response.data.collections.map(board => [board.id, board.previewAssets]))
    const current = data.value
    if (current) portfolioCollectionsCache.value = {
      data: {
        collections: current.data.collections.map(board => ({ ...board, previewAssets: previews.get(board.id) ?? board.previewAssets }))
      }
    }
  } catch {
    return
  } finally {
    boardPreviewsLoading = false
  }
}
watch(data, value => { if (value) void loadBoardPreviews() }, { immediate: true })
const refresh = async () => {
  await refreshCollections()
  if (fetchedData.value) portfolioCollectionsCache.value = fetchedData.value
}
const requestedPortfolioId = String(route.query.portfolio ?? '')
const activePortfolioId = ref(requestedPortfolioId || null)
const portfolios = computed(() => (data.value?.data.collections.filter(board => board.purpose === 'portfolio') ?? [])
  .sort((first, second) => Number(second.portfolio_kind === 'main') - Number(first.portfolio_kind === 'main')))
const workspaceMainPortfolio = computed(() => portfolios.value.find(board => board.portfolio_kind === 'main') ?? null)
const activePortfolio = computed(() => (
  portfolios.value.find(board => board.id === activePortfolioId.value)
  ?? workspaceMainPortfolio.value
  ?? portfolios.value[0]
  ?? null
))
const activePortfolioViewSettings = computed<BoardViewSettings>(() => ({
  showText: true,
  radius: 'default',
  gap: 'default',
  columns: 'auto',
  ...(activePortfolio.value?.view_settings ?? {})
}))
const regularBoards = computed(() => data.value?.data.collections.filter(board => board.purpose !== 'portfolio') ?? [])
const selectedCases = ref<PortfolioCaseSelection[]>([])
const boardsError = ref(false)
const busy = ref(false)
const feedback = ref('')
const feedbackError = ref(false)
const panelStep = ref<'boards' | 'details'>(String(route.query.view ?? '') === 'details' ? 'details' : 'boards')
const detailsRef = ref<{ save: () => Promise<void>; busy: boolean } | null>(null)
const mainPortfolioCreator = ref<{ openCreate: () => Promise<void> } | null>(null)
const clientPortfolioCreator = ref<{ openCreate: () => Promise<void> } | null>(null)
const publicationEnabled = ref(false)
const deleteVersionDialogOpen = ref(false)
const deleteVersionBusy = ref(false)
const deleteVersionError = ref('')
const openBoardActionsId = ref<string | null>(null)
const editingBoardId = ref<string | null>(null)
const boardTitleDraft = ref('')
const boardDescriptionDraft = ref('')
const routedPanel = ref<{ close: () => void } | null>(null)

let feedbackTimer: ReturnType<typeof setTimeout> | undefined
watch([feedback, feedbackError], ([message, isError]) => {
  clearTimeout(feedbackTimer)
  if (!message || isError) return
  feedbackTimer = setTimeout(() => { feedback.value = '' }, 2500)
})
onBeforeUnmount(() => clearTimeout(feedbackTimer))

watch(activePortfolio, (portfolio) => {
  if (portfolio) activePortfolioId.value = portfolio.id
  publicationEnabled.value = portfolio?.publication_enabled ?? false
  editingBoardId.value = null
}, { immediate: true })

const selectedBoards = computed(() => {
  const boards = new Map(regularBoards.value.map(board => [board.id, board]))
  return selectedCases.value.flatMap((selection) => {
    const board = boards.get(selection.caseId)
    return board ? [{
      ...board,
      previewAssets: selection.previewAssets ?? board.previewAssets,
      portfolioTitle: selection.title ?? board.title,
      portfolioDescription: selection.description ?? ''
    }] : []
  })
})
const selectedIds = computed(() => selectedBoards.value.map(board => board.id))
const availableBoards = computed(() => {
  const selected = new Set(selectedIds.value)
  return regularBoards.value.filter(board => !selected.has(board.id))
})
const canEdit = computed(() => !activePortfolio.value || ['owner', 'editor', 'admin'].includes(activePortfolio.value.role))
const canDeleteActiveVersion = computed(() => activePortfolio.value?.portfolio_kind === 'client'
  && ['owner', 'admin'].includes(activePortfolio.value.role))

const loadPortfolioBoards = async () => {
  boardsError.value = false
  const portfolio = activePortfolio.value
  if (!portfolio) {
    selectedCases.value = []
    return
  }
  try {
    const response = await apiFetch<PortfolioBoardsResponse>(`/api/shares/${portfolio.id}/cases`, {
      query: { linksOnly: 'true', previews: 'true', previewLimit: 8 }
    })
    if (activePortfolio.value?.id !== portfolio.id) return
    selectedCases.value = response.data.selectedCases
  } catch {
    selectedCases.value = []
    boardsError.value = true
  }
}

const loadBoardPreviewPage = async (boardId: string, offset: number) => {
  const portfolio = activePortfolio.value
  if (!portfolio) return []
  try {
    const response = await apiFetch<PortfolioBoardPreviewsResponse>(`/api/shares/${portfolio.id}/cases`, {
      query: { previewCaseId: boardId, previewOffset: offset, previewLimit: 8 }
    })
    return activePortfolio.value?.id === portfolio.id ? response.data.previewAssets : []
  } catch {
    return []
  }
}

watch(() => activePortfolio.value?.id, () => { void loadPortfolioBoards() }, { immediate: true })

const ensureActivePortfolio = async () => {
  if (activePortfolio.value) return activePortfolio.value.id
  const response = await apiFetch<CreatePortfolioResponse>('/api/shares', {
    method: 'POST',
    body: {
      title: 'Portfolio',
      purpose: 'portfolio',
      mode: 'static',
      contentStrategy: 'manual',
      layout: 'masonry',
      filters: { search: '', projectId: null, tagId: null, projectIds: [], tagIds: [], uploadedBy: null, dateFrom: null, dateTo: null },
      expiresAt: null,
      reviewMonth: null,
      submissionDeadline: null,
      portfolioKind: 'main',
      portfolioClient: null,
      introduction: null,
      contactHeading: null,
      contactLinks: []
    }
  })
  await refresh()
  return response.data.collection.id
}

const saveBoards = async (nextCases: PortfolioCaseSelection[], message: string) => {
  busy.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    const portfolioId = await ensureActivePortfolio()
    await apiFetch(`/api/shares/${portfolioId}/cases`, { method: 'PUT', body: { cases: nextCases } })
    await loadPortfolioBoards()
    feedback.value = message
    return true
  } catch {
    feedback.value = 'Unable to update the portfolio. Try again.'
    feedbackError.value = true
    return false
  } finally {
    busy.value = false
  }
}

const addBoard = (board: Board) => saveBoards([...selectedCases.value, { caseId: board.id, title: board.title, description: null }], `${board.title} added.`)
const removeBoard = (board: Board) => saveBoards(selectedCases.value.filter(item => item.caseId !== board.id), `${board.title} removed.`)
const moveBoard = (index: number, direction: -1 | 1) => {
  const next = [...selectedCases.value]
  const target = index + direction
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  void saveBoards(next, 'Portfolio order updated.')
}

const editBoardDetails = (board: Board & { portfolioTitle: string; portfolioDescription: string }) => {
  editingBoardId.value = board.id
  boardTitleDraft.value = board.portfolioTitle
  boardDescriptionDraft.value = board.portfolioDescription
  openBoardActionsId.value = null
}

const cancelBoardDetails = () => {
  editingBoardId.value = null
  boardTitleDraft.value = ''
  boardDescriptionDraft.value = ''
}

const saveBoardDetails = async (board: Board & { portfolioTitle: string; portfolioDescription: string }) => {
  const title = boardTitleDraft.value.trim() || board.title
  const description = boardDescriptionDraft.value.trim() || null
  const next = selectedCases.value.map(item => item.caseId === board.id
    ? { caseId: item.caseId, title, description }
    : item)
  if (await saveBoards(next, `${title} updated.`)) cancelBoardDetails()
}

const close = () => routedPanel.value?.close()
const openDetails = () => { panelStep.value = 'details' }
const closeDetails = () => { panelStep.value = 'boards' }
const refreshDetails = async () => { await refresh() }
const selectPortfolio = async (portfolio: Board) => {
  if (portfolio.id === activePortfolio.value?.id) return
  activePortfolioId.value = portfolio.id
  panelStep.value = 'boards'
  publicationEnabled.value = portfolio.publication_enabled
  await navigateTo({ path: '/portfolio', query: { portfolio: portfolio.id } }, { replace: true })
}

watch(() => String(route.query.portfolio ?? ''), (portfolioId) => {
  const nextId = portfolioId || workspaceMainPortfolio.value?.id || portfolios.value[0]?.id || null
  if (nextId === activePortfolioId.value) return
  activePortfolioId.value = nextId
  panelStep.value = String(route.query.view ?? '') === 'details' ? 'details' : 'boards'
})
const updatePublication = (enabled: boolean) => {
  publicationEnabled.value = enabled
}
const requestDeleteVersion = () => {
  if (!canDeleteActiveVersion.value) return
  deleteVersionError.value = ''
  deleteVersionDialogOpen.value = true
}
const deleteActiveVersion = async () => {
  const portfolio = activePortfolio.value
  if (!portfolio || portfolio.portfolio_kind !== 'client' || !canDeleteActiveVersion.value) return
  deleteVersionBusy.value = true
  deleteVersionError.value = ''
  try {
    await apiFetch(`/api/shares/${portfolio.id}`, { method: 'DELETE' })
    deleteVersionDialogOpen.value = false
    panelStep.value = 'boards'
    await refresh()
    const nextPortfolio = workspaceMainPortfolio.value ?? portfolios.value[0] ?? null
    activePortfolioId.value = nextPortfolio?.id ?? null
    await navigateTo(nextPortfolio
      ? { path: '/portfolio', query: { portfolio: nextPortfolio.id } }
      : { path: '/portfolio' }, { replace: true })
  } catch {
    deleteVersionError.value = 'Unable to delete this client version. Check your connection and try again.'
  } finally {
    deleteVersionBusy.value = false
  }
}

</script>

<template>
  <div class="portfolio-page">
    <AppRoutedPanelPage ref="routedPanel" label="Portfolio" close-label="Close portfolio" panel-class="portfolio-controls">
        <Transition name="panel-step" mode="out-in">
        <div :key="panelStep" class="filter-sheet-content">
          <template v-if="panelStep === 'boards'">
          <section class="filter-option-group">
            <h1 class="filter-overlay-title">Portfolio</h1>
            <p v-if="collectionsStatus === 'pending' && !activePortfolio" class="board-type-summary">Loading portfolio…</p>
            <p v-else class="board-type-summary">{{ activePortfolio?.portfolio_kind === 'client' ? activePortfolio.portfolio_client ? `Client version for ${activePortfolio.portfolio_client}.` : 'Client version.' : 'Main portfolio.' }}</p>
          </section>

          <section v-if="portfolios.length" class="filter-option-group" aria-labelledby="portfolio-versions-title">
            <h2 id="portfolio-versions-title" class="filter-overlay-title">Portfolio versions</h2>
            <div class="panel-choice-list">
              <button
                v-for="portfolio in portfolios"
                :key="portfolio.id"
                type="button"
                :aria-pressed="portfolio.id === activePortfolio?.id"
                @click="selectPortfolio(portfolio)"
              >
                <strong>{{ portfolio.title }}</strong>
                <span>{{ portfolio.portfolio_kind === 'main' ? 'Main portfolio' : portfolio.portfolio_client ? `For ${portfolio.portfolio_client}` : 'Client version' }}</span>
              </button>
            </div>
            <button v-if="canEdit" class="panel-secondary-action" type="button" @click="clientPortfolioCreator?.openCreate()">New client version</button>
            <button v-if="canEdit && !workspaceMainPortfolio" class="panel-secondary-action" type="button" @click="mainPortfolioCreator?.openCreate()">Create main portfolio</button>
          </section>

        <section class="filter-option-group" aria-labelledby="portfolio-selected-title">
          <h2 id="portfolio-selected-title" class="filter-overlay-title">Included boards</h2>
            <p v-if="error || boardsError" class="board-type-summary error" role="alert">Unable to load boards.</p>
            <p v-else-if="collectionsStatus === 'pending' && !data" class="board-type-summary">Loading boards…</p>
            <ol v-else-if="selectedBoards.length" class="portfolio-board-list">
            <AppPanelRow
              v-for="(board, index) in selectedBoards"
              :key="board.id"
              as="li"
              class="portfolio-case-row"
              :title="board.title"
              :meta="`${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'}`"
            >
              <div class="portfolio-case-title-row">
                <label v-if="editingBoardId === board.id">
                  <span class="sr-only">Portfolio title for {{ board.title }}</span>
                  <input v-model="boardTitleDraft" class="portfolio-case-title" maxlength="120" placeholder="Portfolio title" :disabled="busy" @keydown.enter.prevent="saveBoardDetails(board)" @keydown.esc.prevent="cancelBoardDetails">
                </label>
                <strong v-else class="portfolio-case-title-static">{{ board.portfolioTitle }}</strong>
              </div>
              <label v-if="editingBoardId === board.id">
                <span class="sr-only">Portfolio description for {{ board.title }}</span>
                <textarea v-model="boardDescriptionDraft" class="portfolio-case-description" rows="1" maxlength="1000" placeholder="Add a short description (optional)" :disabled="busy" @keydown.esc.prevent="cancelBoardDetails" />
              </label>
              <p v-else-if="board.portfolioDescription" class="portfolio-case-description-static">{{ board.portfolioDescription }}</p>
              <BoardMatchPreviews
                v-if="board.previewAssets.length"
                :assets="board.previewAssets"
                :label="`Assets in ${board.title}`"
                :total="board.itemCount"
                :load-more="offset => loadBoardPreviewPage(board.id, offset)"
              />
              <template #actions>
                <span class="portfolio-case-count">{{ board.itemCount }} {{ board.itemCount === 1 ? 'asset' : 'assets' }}</span>
                <template v-if="editingBoardId === board.id">
                  <button class="panel-secondary-action panel-compact-action" type="button" :disabled="busy" @click="cancelBoardDetails">Cancel</button>
                  <button class="panel-primary-action portfolio-case-save" type="button" :disabled="busy || !boardTitleDraft.trim()" @click="saveBoardDetails(board)">{{ busy ? 'Saving…' : 'Save' }}</button>
                </template>
                <button v-else-if="canEdit" class="panel-secondary-action panel-compact-action portfolio-edit-action" type="button" :disabled="busy" @click="editBoardDetails(board)">Edit</button>
                <NuxtLink
                  v-if="editingBoardId !== board.id"
                  class="panel-secondary-action panel-compact-action portfolio-source-link"
                  :to="{ path: '/library', query: { board: board.id } }"
                  target="_blank"
                  rel="noopener"
                  :aria-label="`Open ${board.title} in a new tab`"
                  title="Open board"
                >Open</NuxtLink>
                <AppDropdownMenu
                  v-if="canEdit && editingBoardId !== board.id"
                  :open="openBoardActionsId === board.id"
                  align="end"
                  content-class="panel-dropdown-menu"
                  @update:open="openBoardActionsId = $event ? board.id : null"
                >
                  <template #trigger="{ triggerProps }">
                    <button v-bind="triggerProps" class="panel-secondary-action panel-icon-action portfolio-case-more" type="button" :disabled="busy" :aria-label="`Actions for ${board.title}`">
                      <MoreH :size="18" aria-hidden="true" />
                    </button>
                  </template>
                  <template #default>
                    <button role="menuitem" type="button" :disabled="busy || index === 0" @click="moveBoard(index, -1)">Move earlier</button>
                    <button role="menuitem" type="button" :disabled="busy || index === selectedBoards.length - 1" @click="moveBoard(index, 1)">Move later</button>
                    <button role="menuitem" type="button" :disabled="busy" @click="removeBoard(board)">Remove</button>
                  </template>
                </AppDropdownMenu>
              </template>
            </AppPanelRow>
          </ol>
          <p v-else-if="!error" class="board-type-summary">No boards added yet. Choose one below to start your portfolio.</p>
        </section>

        <section v-if="availableBoards.length && canEdit" class="filter-option-group" aria-labelledby="portfolio-available-title">
          <h2 id="portfolio-available-title" class="filter-overlay-title">Add boards</h2>
          <p class="board-type-summary">Use work you have already arranged in the library.</p>
          <div class="panel-choice-list portfolio-board-options">
            <button v-for="board in availableBoards" :key="board.id" type="button" :disabled="busy" :aria-label="`Add ${board.title} to portfolio`" @click="addBoard(board)">
              <span class="portfolio-board-option-preview" aria-hidden="true">
                <AssetMedia v-if="board.previewAssets[0]" :src="board.previewAssets[0].previewUrl" :mime-type="board.previewAssets[0].mime_type ?? ''" :width="board.previewAssets[0].width" :height="board.previewAssets[0].height" alt="" loading="lazy" />
              </span>
              <span class="portfolio-board-option-copy">
                <strong>{{ board.title }}</strong>
                <span>{{ board.itemCount }} {{ board.itemCount === 1 ? 'item' : 'items' }}</span>
              </span>
            </button>
          </div>
        </section>

          <section v-else-if="collectionsStatus !== 'pending' && !regularBoards.length" class="filter-option-group" aria-labelledby="portfolio-no-boards-title">
          <h2 id="portfolio-no-boards-title" class="filter-overlay-title">No boards available</h2>
          <p class="board-type-summary">Create and arrange a board in the library, then add it here.</p>
          <button class="panel-secondary-action" type="button" @click="close">Go to library</button>
        </section>

          <AppStatusToast :message="feedback" :error="feedbackError" />
          </template>
          <PortfolioDetailsControls
            v-else-if="activePortfolio"
            ref="detailsRef"
            :board-id="activePortfolio.id"
            :slug="activePortfolio.slug"
            :title="activePortfolio.title"
            :portfolio-kind="activePortfolio.portfolio_kind"
            :portfolio-client="activePortfolio.portfolio_client"
            :introduction="activePortfolio.introduction"
            :contact-heading="activePortfolio.contact_heading"
            :contact-links="activePortfolio.contact_links"
            :layout="activePortfolio.layout"
            :view-settings="activePortfolioViewSettings"
            :publication-enabled="publicationEnabled"
            :can-edit="canEdit"
            :can-delete="canDeleteActiveVersion"
            @saved="refreshDetails"
            @publication-changed="updatePublication"
            @layout-changed="refreshDetails"
            @view-settings-changed="refreshDetails"
            @delete-requested="requestDeleteVersion"
          />
        </div>
        </Transition>
        <AppPanelActions :visible="Boolean(activePortfolio)">
          <button v-if="panelStep === 'boards'" class="panel-primary-action" type="button" :disabled="busy" @click="openDetails">Manage details and publishing</button>
          <template v-else>
            <button class="panel-secondary-action" type="button" :disabled="detailsRef?.busy" @click="closeDetails">Back</button>
            <button class="panel-primary-action" type="button" :disabled="detailsRef?.busy" @click="detailsRef?.save()">Save details</button>
          </template>
        </AppPanelActions>
    </AppRoutedPanelPage>
    <ShareCollection ref="mainPortfolioCreator" portfolio-only hide-trigger default-portfolio-kind="main" />
    <ShareCollection ref="clientPortfolioCreator" portfolio-only hide-trigger default-portfolio-kind="client" />
    <AppDialog
      v-model:open="deleteVersionDialogOpen"
      :title="`Delete “${activePortfolio?.title ?? 'client version'}”?`"
      description="This permanently deletes this client version, its board selection, member access, and public link. The main portfolio is not affected."
      :confirm-label="deleteVersionBusy ? 'Deleting client version…' : 'Delete client version'"
      :busy="deleteVersionBusy"
      :error="deleteVersionError"
      @confirm="deleteActiveVersion"
      @close="deleteVersionError = ''"
    />
  </div>
</template>

<style scoped>
.portfolio-page { min-height: 100vh; }

.portfolio-board-list {
  display: grid;
  gap: var(--filter-option-padding);
  margin: 0;
  padding: 0;
  list-style: none;
}

.panel-choice-list span {
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-caption);
}

.portfolio-board-options > button {
  grid-template-columns: calc(var(--filter-overlay-row-height) - var(--filter-option-padding) - var(--filter-option-padding)) minmax(0, 1fr);
  align-items: center;
  gap: var(--filter-option-gap);
}

.portfolio-board-option-preview {
  width: 100%;
  aspect-ratio: 1;
  display: block;
  overflow: hidden;
  border-radius: max(0px, calc(var(--radius) * 1.5 - var(--filter-option-padding)));
  background: var(--filter-overlay-nested-background);
}

.portfolio-board-option-preview :deep(:is(img, video)) {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.portfolio-board-option-copy {
  min-width: 0;
  display: grid;
  gap: calc(var(--filter-option-gap) / 2);
}

.portfolio-board-option-copy strong {
  overflow: hidden;
  color: var(--filter-overlay-panel-color);
  font-size: var(--filter-action-font-size);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portfolio-case-row {
  grid-template-columns: minmax(0, 1fr);
  padding: var(--filter-option-padding);
}

.portfolio-case-row :deep(.app-panel-row-content) {
  gap: calc(var(--filter-option-gap) / 2);
  padding: 0;
}

.portfolio-case-row :deep(.board-match-previews) {
  margin-top: calc(var(--filter-option-gap) / 2);
  margin-inline: calc(var(--filter-option-padding) / 2);
}

.portfolio-case-row :deep(.app-panel-row-actions) {
  width: 100%;
  justify-content: flex-end;
  padding: calc(var(--filter-option-padding) / 2) calc(var(--filter-option-padding) / 2) 0;
}

.portfolio-case-title-row {
  min-width: 0;
}

.portfolio-case-title-row label { min-width: 0; }

.portfolio-case-row :deep(.portfolio-case-count) {
  margin-inline-end: auto;
  padding-inline: calc(var(--filter-option-padding) / 2);
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-caption);
  white-space: nowrap;
}

.portfolio-case-title,
.portfolio-case-description {
  box-sizing: border-box;
  width: 100%;
  border: 0;
  border-radius: calc(var(--radius) * .75);
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  font: inherit;
  font-size: var(--filter-action-font-size);
  transition: background-color 150ms ease-out;
}

.portfolio-case-title {
  height: calc(var(--filter-action-height) - .5rem);
  min-height: calc(var(--filter-action-height) - .5rem);
  padding-block: 0;
  padding-inline: calc(var(--filter-option-padding) / 2);
  font-size: var(--filter-field-font-size);
  font-weight: 600;
  line-height: 1;
}

.portfolio-case-title-static {
  min-width: 0;
  padding-inline: calc(var(--filter-option-padding) / 2);
  font-size: var(--filter-field-font-size);
  font-weight: 600;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.portfolio-case-description {
  min-height: calc(var(--filter-action-height) - .5rem);
  max-height: calc(var(--filter-action-height) * 4);
  padding: calc(var(--filter-option-padding) * .75) calc(var(--filter-option-padding) / 2);
  color: var(--filter-overlay-muted-color);
  field-sizing: content;
  line-height: 1.3;
  resize: none;
}

.portfolio-case-description-static {
  margin: 0;
  padding: calc(var(--filter-option-padding) / 2);
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-action-font-size);
  line-height: 1.3;
  white-space: pre-line;
}

.portfolio-case-title::placeholder,
.portfolio-case-description::placeholder { color: var(--filter-overlay-muted-color); opacity: 1; }

.portfolio-case-title:focus,
.portfolio-case-description:focus {
  outline: 0;
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
}

.portfolio-case-row :deep(:is(.portfolio-edit-action, .portfolio-source-link)) {
  flex: 0 0 auto;
  gap: calc(var(--filter-action-gap) / 2);
}

.portfolio-case-row :deep(.portfolio-case-more.panel-icon-action) {
  width: calc(var(--filter-action-height) - .5rem);
  min-width: calc(var(--filter-action-height) - .5rem);
  min-height: calc(var(--filter-action-height) - .5rem);
  flex-basis: calc(var(--filter-action-height) - .5rem);
}

.portfolio-case-row :deep(.portfolio-case-save) {
  width: fit-content;
  min-height: calc(var(--filter-action-height) - .5rem);
  padding-inline: var(--filter-option-padding);
}

</style>
