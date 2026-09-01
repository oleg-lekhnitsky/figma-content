<script setup lang="ts">
import type { BoardLayout, BoardViewSettings } from '@content-library/shared'
import { ArrowDown, ArrowUp, Xmark } from 'reicon-vue'

definePageMeta({ middleware: 'auth' })

interface PreviewAsset {
  id: string
  previewUrl: string
  mime_type?: string | null
  width?: number
  height?: number
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
}

interface PortfolioBoardsResponse {
  data: {
    selectedIds: string[]
    selectedCases: PortfolioCaseSelection[]
  }
}

interface CreatePortfolioResponse {
  data: { collection: Board }
}

const apiFetch = useRequestFetch()
const route = useRoute()
const { data, error, refresh } = await useFetch<{ data: { collections: Board[] } }>('/api/shares', {
  query: { previews: 'false' }
})
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
}, { immediate: true })

const selectedBoards = computed(() => {
  const boards = new Map(regularBoards.value.map(board => [board.id, board]))
  return selectedCases.value.flatMap((selection) => {
    const board = boards.get(selection.caseId)
    return board ? [{ ...board, portfolioTitle: selection.title ?? board.title, portfolioDescription: selection.description ?? '' }] : []
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
      query: { linksOnly: 'true' }
    })
    if (activePortfolio.value?.id !== portfolio.id) return
    selectedCases.value = response.data.selectedCases
  } catch {
    selectedCases.value = []
    boardsError.value = true
  }
}

await loadPortfolioBoards()

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
  } catch {
    feedback.value = 'Unable to update the portfolio. Try again.'
    feedbackError.value = true
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

const saveBoardDetails = (board: Board & { portfolioTitle: string; portfolioDescription: string }) => {
  const next = selectedCases.value.map(item => item.caseId === board.id
    ? { caseId: item.caseId, title: board.portfolioTitle.trim() || board.title, description: board.portfolioDescription.trim() || null }
    : item)
  void saveBoards(next, `${board.portfolioTitle.trim() || board.title} updated.`)
}

const close = () => navigateTo('/library')
const openDetails = () => { panelStep.value = 'details' }
const closeDetails = () => { panelStep.value = 'boards' }
const refreshDetails = async () => { await refresh() }
const selectPortfolio = async (portfolio: Board) => {
  if (portfolio.id === activePortfolio.value?.id) return
  activePortfolioId.value = portfolio.id
  panelStep.value = 'boards'
  publicationEnabled.value = portfolio.publication_enabled
  await navigateTo({ path: '/portfolio', query: { portfolio: portfolio.id } }, { replace: true })
  await loadPortfolioBoards()
}

watch(() => String(route.query.portfolio ?? ''), async (portfolioId) => {
  const nextId = portfolioId || workspaceMainPortfolio.value?.id || portfolios.value[0]?.id || null
  if (nextId === activePortfolioId.value) return
  activePortfolioId.value = nextId
  panelStep.value = String(route.query.view ?? '') === 'details' ? 'details' : 'boards'
  await loadPortfolioBoards()
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
    await loadPortfolioBoards()
  } catch {
    deleteVersionError.value = 'Unable to delete this client version. Check your connection and try again.'
  } finally {
    deleteVersionBusy.value = false
  }
}

</script>

<template>
  <div class="portfolio-page">
    <SelectionPanel visible label="Portfolio" wide overlay @close="close">
      <div class="asset-filter-controls asset-filter-controls--filters asset-filter-controls--expanded portfolio-controls">
        <Transition name="panel-step" mode="out-in">
        <div :key="panelStep" class="filter-sheet-content">
          <template v-if="panelStep === 'boards'">
          <section class="filter-option-group">
            <h1 class="filter-overlay-title">Portfolio</h1>
            <p class="board-type-summary">{{ activePortfolio?.portfolio_kind === 'client' ? activePortfolio.portfolio_client ? `Client version for ${activePortfolio.portfolio_client}.` : 'Client version.' : 'Main portfolio.' }}</p>
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
          <p class="board-type-summary">Boards remain available in the library when they are added here.</p>
          <p v-if="error || boardsError" class="board-type-summary error" role="alert">Unable to load boards.</p>
          <ol v-else-if="selectedBoards.length" class="portfolio-board-list">
            <AppPanelRow
              v-for="(board, index) in selectedBoards"
              :key="board.id"
              as="li"
              class="portfolio-case-row"
              :title="board.title"
              :meta="`${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'}`"
            >
              <div class="portfolio-case-source">
                <strong>{{ board.title }}</strong>
                <span>{{ board.itemCount }} {{ board.itemCount === 1 ? 'asset' : 'assets' }}</span>
              </div>
              <label>
                <span class="sr-only">Portfolio title for {{ board.title }}</span>
                <input v-model="board.portfolioTitle" class="panel-field" maxlength="120" placeholder="Portfolio title" :disabled="busy || !canEdit" @change="saveBoardDetails(board)">
              </label>
              <label>
                <span class="sr-only">Portfolio description for {{ board.title }}</span>
                <textarea v-model="board.portfolioDescription" class="panel-field portfolio-case-description" rows="2" maxlength="1000" placeholder="Add a short description (optional)" :disabled="busy || !canEdit" @change="saveBoardDetails(board)" />
              </label>
              <template #actions>
                <NuxtLink
                  class="panel-secondary-action portfolio-source-link"
                  :to="{ path: '/library', query: { board: board.id } }"
                  target="_blank"
                  rel="noopener"
                  :aria-label="`Open ${board.title} in a new tab`"
                >Open board</NuxtLink>
                <button v-if="canEdit" class="panel-secondary-action panel-icon-action" type="button" :disabled="busy || index === 0" :aria-label="`Move ${board.title} earlier`" @click="moveBoard(index, -1)"><ArrowUp :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /></button>
                <button v-if="canEdit" class="panel-secondary-action panel-icon-action" type="button" :disabled="busy || index === selectedBoards.length - 1" :aria-label="`Move ${board.title} later`" @click="moveBoard(index, 1)"><ArrowDown :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /></button>
                <button v-if="canEdit" class="panel-secondary-action" type="button" :disabled="busy" @click="removeBoard(board)">Remove</button>
              </template>
            </AppPanelRow>
          </ol>
          <p v-else-if="!error" class="board-type-summary">No boards added yet. Choose one below to start your portfolio.</p>
        </section>

        <section v-if="availableBoards.length && canEdit" class="filter-option-group" aria-labelledby="portfolio-available-title">
          <h2 id="portfolio-available-title" class="filter-overlay-title">Add boards</h2>
          <p class="board-type-summary">Use work you have already arranged in the library.</p>
          <div class="panel-choice-list">
            <button v-for="board in availableBoards" :key="board.id" type="button" :disabled="busy" @click="addBoard(board)">
              <strong>Add {{ board.title }}</strong>
              <span>{{ board.itemCount }} {{ board.itemCount === 1 ? 'item' : 'items' }}</span>
            </button>
          </div>
        </section>

        <section v-else-if="!regularBoards.length" class="filter-option-group" aria-labelledby="portfolio-no-boards-title">
          <h2 id="portfolio-no-boards-title" class="filter-overlay-title">No boards available</h2>
          <p class="board-type-summary">Create and arrange a board in the library, then add it here.</p>
          <NuxtLink class="panel-secondary-action" to="/library">Go to library</NuxtLink>
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
        <button class="filter-sheet-handle" type="button" aria-label="Close portfolio" @click="close"><span /></button>
      </div>
      <button class="filter-panel-toggle is-expanded" type="button" aria-label="Close portfolio" aria-expanded="true" @click="close"><Xmark :size="20" :stroke-width="2" aria-hidden="true" /></button>
    </SelectionPanel>
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
  gap: var(--filter-option-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}

.panel-choice-list span {
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-caption);
}

.portfolio-case-row { grid-template-columns: minmax(0, 1fr); }
.portfolio-case-row :deep(.app-panel-row-content) { padding: 0; }
.portfolio-case-row :deep(.app-panel-row-actions) { width: 100%; }
.portfolio-case-source { display: flex; align-items: baseline; justify-content: space-between; gap: var(--filter-option-gap); padding-inline: var(--filter-option-padding); }
.portfolio-case-source strong { font-size: var(--filter-action-font-size); font-weight: 600; }
.portfolio-case-source span { color: var(--filter-overlay-muted-color); font-size: var(--font-size-caption); }
.portfolio-case-description { min-height: calc(var(--filter-action-height) * 1.5); }
.portfolio-source-link { flex: 1 1 auto; }

</style>
