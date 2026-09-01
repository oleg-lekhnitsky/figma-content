<script setup lang="ts">
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
}

interface PortfolioBoardsResponse {
  data: {
    selectedIds: string[]
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
const portfolios = computed(() => data.value?.data.collections.filter(board => board.purpose === 'portfolio') ?? [])
const mainPortfolio = computed(() => (
  portfolios.value.find(board => board.id === activePortfolioId.value)
  ?? portfolios.value.find(board => board.portfolio_kind === 'main')
  ?? portfolios.value[0]
  ?? null
))
const regularBoards = computed(() => data.value?.data.collections.filter(board => board.purpose !== 'portfolio') ?? [])
const selectedBoardIds = ref<string[]>([])
const boardsError = ref(false)
const busy = ref(false)
const feedback = ref('')
const feedbackError = ref(false)
const panelStep = ref<'boards' | 'details'>(String(route.query.view ?? '') === 'details' ? 'details' : 'boards')
const detailsRef = ref<{ save: () => Promise<void>; busy: boolean } | null>(null)
const publicationEnabled = ref(false)

watch(mainPortfolio, (portfolio) => {
  if (portfolio) activePortfolioId.value = portfolio.id
  publicationEnabled.value = portfolio?.publication_enabled ?? false
}, { immediate: true })

const selectedBoards = computed(() => {
  const boards = new Map(regularBoards.value.map(board => [board.id, board]))
  return selectedBoardIds.value.flatMap(id => boards.get(id) ?? [])
})
const selectedIds = computed(() => selectedBoards.value.map(board => board.id))
const availableBoards = computed(() => {
  const selected = new Set(selectedIds.value)
  return regularBoards.value.filter(board => !selected.has(board.id))
})
const canEdit = computed(() => !mainPortfolio.value || ['owner', 'editor', 'admin'].includes(mainPortfolio.value.role))

const loadPortfolioBoards = async () => {
  boardsError.value = false
  const portfolio = mainPortfolio.value
  if (!portfolio) {
    selectedBoardIds.value = []
    return
  }
  try {
    const response = await apiFetch<PortfolioBoardsResponse>(`/api/shares/${portfolio.id}/cases`, {
      query: { linksOnly: 'true' }
    })
    if (mainPortfolio.value?.id !== portfolio.id) return
    selectedBoardIds.value = response.data.selectedIds
  } catch {
    selectedBoardIds.value = []
    boardsError.value = true
  }
}

await loadPortfolioBoards()

const ensureMainPortfolio = async () => {
  if (mainPortfolio.value) return mainPortfolio.value.id
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

const saveBoards = async (nextIds: string[], message: string) => {
  busy.value = true
  feedback.value = ''
  feedbackError.value = false
  try {
    const portfolioId = await ensureMainPortfolio()
    await apiFetch(`/api/shares/${portfolioId}/cases`, { method: 'PUT', body: { caseIds: nextIds } })
    await loadPortfolioBoards()
    feedback.value = message
  } catch {
    feedback.value = 'Unable to update the portfolio. Try again.'
    feedbackError.value = true
  } finally {
    busy.value = false
  }
}

const addBoard = (board: Board) => saveBoards([...selectedIds.value, board.id], `${board.title} added.`)
const removeBoard = (board: Board) => saveBoards(selectedIds.value.filter(id => id !== board.id), `${board.title} removed.`)
const moveBoard = (index: number, direction: -1 | 1) => {
  const next = [...selectedIds.value]
  const target = index + direction
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  void saveBoards(next, 'Portfolio order updated.')
}

const close = () => navigateTo('/library')
const openDetails = () => { panelStep.value = 'details' }
const closeDetails = () => { panelStep.value = 'boards' }
const refreshDetails = async () => { await refresh() }
const updatePublication = (enabled: boolean) => {
  publicationEnabled.value = enabled
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
            <p class="board-type-summary">Choose existing boards and arrange the order in which they appear.</p>
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
              :title="board.title"
              :meta="`${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'}`"
              :to="{ path: '/library', query: { board: board.id } }"
            >
              <template v-if="canEdit" #actions>
                <button class="panel-secondary-action panel-icon-action" type="button" :disabled="busy || index === 0" :aria-label="`Move ${board.title} earlier`" @click="moveBoard(index, -1)"><ArrowUp :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /></button>
                <button class="panel-secondary-action panel-icon-action" type="button" :disabled="busy || index === selectedBoards.length - 1" :aria-label="`Move ${board.title} later`" @click="moveBoard(index, 1)"><ArrowDown :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /></button>
                <button class="panel-secondary-action" type="button" :disabled="busy" @click="removeBoard(board)">Remove</button>
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

          <p class="portfolio-feedback board-type-summary" :class="{ error: feedbackError }" role="status" aria-live="polite">{{ feedback }}</p>
          </template>
          <PortfolioDetailsControls
            v-else-if="mainPortfolio"
            ref="detailsRef"
            :board-id="mainPortfolio.id"
            :slug="mainPortfolio.slug"
            :title="mainPortfolio.title"
            :portfolio-kind="mainPortfolio.portfolio_kind"
            :portfolio-client="mainPortfolio.portfolio_client"
            :introduction="mainPortfolio.introduction"
            :contact-heading="mainPortfolio.contact_heading"
            :contact-links="mainPortfolio.contact_links"
            :publication-enabled="publicationEnabled"
            :can-edit="canEdit"
            @saved="refreshDetails"
            @publication-changed="updatePublication"
          />
        </div>
        </Transition>
        <AppPanelActions :visible="Boolean(mainPortfolio)">
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

.portfolio-feedback:empty { display: none; }

</style>
