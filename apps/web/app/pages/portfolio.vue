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
}

interface PortfolioBoardsResponse {
  data: {
    cases: Board[]
    selectedIds: string[]
    selectedCases: Board[]
  }
}

interface CreatePortfolioResponse {
  data: { collection: Board }
}

const apiFetch = useRequestFetch()
const { data, status, error, refresh } = await useFetch<{ data: { collections: Board[] } }>('/api/shares')
const mainPortfolio = computed(() => data.value?.data.collections.find(board => board.purpose === 'portfolio' && board.portfolio_kind === 'main') ?? null)
const regularBoards = computed(() => data.value?.data.collections.filter(board => board.purpose !== 'portfolio') ?? [])
const selectedBoards = ref<Board[]>([])
const busy = ref(false)
const feedback = ref('')
const feedbackError = ref(false)

const selectedIds = computed(() => selectedBoards.value.map(board => board.id))
const availableBoards = computed(() => {
  const selected = new Set(selectedIds.value)
  return regularBoards.value.filter(board => !selected.has(board.id))
})
const canEdit = computed(() => !mainPortfolio.value || ['owner', 'editor', 'admin'].includes(mainPortfolio.value.role))

const loadPortfolioBoards = async () => {
  if (!mainPortfolio.value) {
    selectedBoards.value = []
    return
  }
  const response = await apiFetch<PortfolioBoardsResponse>(`/api/shares/${mainPortfolio.value.id}/cases`)
  selectedBoards.value = response.data.selectedCases
}

if (mainPortfolio.value) await loadPortfolioBoards()

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

onActivated(async () => {
  await refresh()
  await loadPortfolioBoards()
})
</script>

<template>
  <div class="portfolio-page">
    <SelectionPanel visible label="Portfolio" wide overlay @close="close">
      <div class="asset-filter-controls asset-filter-controls--expanded portfolio-controls">
        <div class="filter-sheet-content">
          <div class="board-settings-intro">
            <h1 class="filter-overlay-title">Portfolio</h1>
            <p class="board-type-summary">Choose existing boards and arrange the order in which they appear.</p>
          </div>

        <section class="filter-option-group" aria-labelledby="portfolio-selected-title">
          <div class="board-settings-intro">
            <h2 id="portfolio-selected-title" class="filter-option-label">Included boards</h2>
            <p class="board-type-summary">Boards remain available in the library when they are added here.</p>
          </div>
          <p v-if="status === 'pending'" class="board-type-summary" role="status">Loading boards…</p>
          <p v-else-if="error" class="board-type-summary error" role="alert">Unable to load boards.</p>
          <ol v-else-if="selectedBoards.length" class="portfolio-board-list">
            <li v-for="(board, index) in selectedBoards" :key="board.id" class="portfolio-board-row">
              <NuxtLink class="portfolio-board-summary" :to="{ path: '/library', query: { board: board.id } }">
                <span>{{ board.title }}</span>
                <small>{{ board.itemCount }} {{ board.itemCount === 1 ? 'item' : 'items' }}</small>
              </NuxtLink>
              <div v-if="canEdit" class="portfolio-board-actions">
                <button class="panel-secondary-action panel-icon-action" type="button" :disabled="busy || index === 0" :aria-label="`Move ${board.title} earlier`" @click="moveBoard(index, -1)"><ArrowUp :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /></button>
                <button class="panel-secondary-action panel-icon-action" type="button" :disabled="busy || index === selectedBoards.length - 1" :aria-label="`Move ${board.title} later`" @click="moveBoard(index, 1)"><ArrowDown :size="20" weight="Outline" :stroke-width="1.75" aria-hidden="true" /></button>
                <button class="panel-secondary-action" type="button" :disabled="busy" @click="removeBoard(board)">Remove</button>
              </div>
            </li>
          </ol>
          <p v-else-if="!error" class="board-type-summary">No boards added yet. Choose one below to start your portfolio.</p>
        </section>

        <section v-if="availableBoards.length && canEdit" class="filter-option-group" aria-labelledby="portfolio-available-title">
          <div class="board-settings-intro">
            <h2 id="portfolio-available-title" class="filter-option-label">Add boards</h2>
            <p class="board-type-summary">Use work you have already arranged in the library.</p>
          </div>
          <div class="available-board-list">
            <button v-for="board in availableBoards" :key="board.id" class="panel-secondary-action available-board" type="button" :disabled="busy" @click="addBoard(board)">
              <span>Add {{ board.title }}</span>
              <small>{{ board.itemCount }} {{ board.itemCount === 1 ? 'item' : 'items' }}</small>
            </button>
          </div>
        </section>

        <section v-else-if="!regularBoards.length && status !== 'pending'" class="filter-option-group" aria-labelledby="portfolio-no-boards-title">
          <h2 id="portfolio-no-boards-title" class="filter-option-label">No boards available</h2>
          <p class="board-type-summary">Create and arrange a board in the library, then add it here.</p>
          <NuxtLink class="panel-secondary-action" to="/library">Go to library</NuxtLink>
        </section>

        <section v-if="mainPortfolio" class="filter-option-group" aria-labelledby="portfolio-publishing-title">
          <div class="board-settings-intro">
            <h2 id="portfolio-publishing-title" class="filter-option-label">Publishing</h2>
            <p class="board-type-summary">{{ mainPortfolio.publication_enabled ? 'Your portfolio is available through its public link.' : 'Add your details and publish when it is ready.' }}</p>
          </div>
          <NuxtLink class="panel-secondary-action" :to="`/boards/${mainPortfolio.id}`">Manage details and publishing</NuxtLink>
        </section>

          <p class="portfolio-feedback board-type-summary" :class="{ error: feedbackError }" role="status" aria-live="polite">{{ feedback }}</p>
        </div>
        <button class="filter-sheet-handle" type="button" aria-label="Close portfolio" @click="close"><span /></button>
      </div>
      <button class="filter-panel-toggle is-expanded" type="button" aria-label="Close portfolio" aria-expanded="true" @click="close"><Xmark :size="20" :stroke-width="2" aria-hidden="true" /></button>
    </SelectionPanel>
  </div>
</template>

<style scoped>
.portfolio-page { min-height: 100vh; }

.portfolio-board-list,
.available-board-list {
  display: grid;
  gap: var(--filter-action-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}

.portfolio-board-row {
  display: grid;
  gap: var(--filter-action-gap);
  padding: var(--filter-option-padding);
  border-radius: calc(var(--radius) * 1.5);
  background: var(--filter-overlay-nested-background);
}

.portfolio-board-summary,
.available-board {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  color: inherit;
  text-decoration: none;
}

.portfolio-board-summary span,
.available-board span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portfolio-board-summary small,
.available-board small {
  flex: 0 0 auto;
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-caption-size);
}

.portfolio-board-actions {
  display: flex;
  align-items: center;
  gap: var(--filter-action-gap);
}

.portfolio-board-actions > button:last-child { flex: 1 1 auto; }
.portfolio-feedback:empty { display: none; }

</style>
