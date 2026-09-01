<script setup lang="ts">
import { Xmark } from 'reicon-vue'

interface Board {
  id: string
  title: string
  purpose: 'showcase' | 'review' | 'portfolio' | 'case'
  mode: 'dynamic' | 'static'
  role: string
  itemCount: number
  assetIds: string[]
  previewAssets: Array<{ id: string; previewUrl: string; mime_type?: string | null }>
}

const props = defineProps<{
  visible: boolean
  assetId: string
  assetOwnerId?: string
  currentUserId?: string
  boards: Board[]
}>()
const emit = defineEmits<{
  close: []
  afterLeave: []
  createBoard: []
  addedToBoard: [assetId: string, boardId: string, approved: boolean]
}>()

const searchInput = ref<HTMLInputElement>()
const search = ref('')
const addingBoardId = ref('')
const feedback = ref('')
const eligibleBoards = computed(() => props.boards.filter(board => board.purpose !== 'portfolio'
  && board.mode === 'static'
  && !board.assetIds.includes(props.assetId)
  && ['owner', 'editor', 'contributor', 'admin'].includes(board.role)
  && (board.role !== 'contributor' || props.assetOwnerId === props.currentUserId)))
const filteredBoards = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return term ? eligibleBoards.value.filter(board => board.title.toLocaleLowerCase().includes(term)) : eligibleBoards.value
})

const addToBoard = async (boardId: string) => {
  if (addingBoardId.value) return
  feedback.value = ''
  addingBoardId.value = boardId
  try {
    const response = await $fetch<{ data: { added: boolean; approved: boolean } }>(`/api/shares/${boardId}/assets`, {
      method: 'POST',
      body: { assetId: props.assetId }
    })
    emit('addedToBoard', props.assetId, boardId, response.data.approved)
    emit('close')
  } catch {
    feedback.value = 'Unable to add this asset to the board.'
  } finally {
    addingBoardId.value = ''
  }
}

onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => searchInput.value?.focus({ preventScroll: true }))))
</script>

<template>
  <SelectionPanel :visible="visible" label="Add to board" wide overlay raised @close="emit('close')" @after-leave="emit('afterLeave')">
    <form class="asset-filter-controls asset-filter-controls--expanded asset-board-picker" aria-label="Choose a board" @submit.prevent>
      <button class="filter-sheet-handle" type="button" aria-label="Close board picker"><span aria-hidden="true" /></button>
      <div class="filter-sheet-content">
        <h2 class="filter-overlay-title">Add to board or create&nbsp;one</h2>
        <div class="filter-option-group">
          <label><span class="sr-only">Search boards</span><input ref="searchInput" v-model="search" class="panel-field" type="search" placeholder="Search boards"></label>
        </div>
        <div class="filter-option-group asset-board-options">
          <div class="asset-board-list">
            <button
              v-for="board in filteredBoards" :key="board.id" class="panel-secondary-action asset-board-option" type="button"
              :disabled="Boolean(addingBoardId)" :aria-label="`Add asset to ${board.title}`"
              @click="addToBoard(board.id)">
              <span class="asset-board-preview" :class="{ 'is-empty': !board.previewAssets.length }">
                <AssetMedia
                  v-if="board.previewAssets[0]" :src="board.previewAssets[0].previewUrl"
                  :mime-type="board.previewAssets[0].mime_type" alt="" loading="lazy" />
                <span v-else aria-hidden="true" />
              </span>
              <span class="asset-board-info"><strong>{{ board.title }}</strong><span>{{ addingBoardId === board.id
                ? 'Adding…'
                : `${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'}` }}</span></span>
            </button>
            <p v-if="!filteredBoards.length" class="asset-board-empty">No boards found</p>
          </div>
          <p class="asset-board-feedback" role="status" aria-live="polite">{{ feedback }}</p>
        </div>
      </div>
      <AppPanelActions>
        <button class="panel-primary-action" type="button" @click="emit('createBoard')">New board</button>
      </AppPanelActions>
    </form>
    <button class="filter-panel-toggle is-expanded" type="button" aria-label="Close board picker" aria-expanded="true" @click="emit('close')">
      <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
    </button>
  </SelectionPanel>
</template>

<style scoped>
.asset-board-options { min-height: 0; }
.asset-board-list { min-height: 0; display: grid; gap: var(--filter-option-gap); overflow-y: auto; overscroll-behavior: contain; }
.asset-board-option { width: 100%; min-height: var(--filter-overlay-row-height); display: grid; grid-template-columns: var(--filter-action-height) minmax(0, 1fr); align-items: center; gap: var(--filter-action-gap); padding: var(--filter-option-padding); font-size: var(--filter-option-font-size); text-align: start; }
.asset-board-preview { width: var(--filter-action-height); height: var(--filter-action-height); display: block; overflow: hidden; border-radius: max(0px, calc(var(--radius) * 1.5 - var(--filter-option-padding))); background: var(--filter-overlay-nested-background); box-shadow: inset 0 0 0 1px oklch(1 0 0 / .1); }
.asset-board-preview :deep(:is(img, video)), .asset-board-preview.is-empty > span { width: 100%; height: 100%; display: block; object-fit: cover; }
.asset-board-info { min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: var(--filter-action-gap); }
.asset-board-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-board-info > span, .asset-board-empty, .asset-board-feedback { color: var(--filter-overlay-muted-color); }
.asset-board-info > span { flex: 0 0 auto; }
.asset-board-empty { margin: var(--filter-overlay-group-gap) 0; text-align: center; }
.asset-board-feedback { min-height: 1em; margin: 0; font-size: var(--filter-caption-size); }
.asset-board-feedback:empty { display: none; }

@media (max-width: 520px) {
  .asset-board-picker { height: var(--filter-sheet-height-mobile); max-height: var(--filter-sheet-height-mobile); }
  .asset-board-option { min-height: var(--filter-sheet-row-height-mobile); font-size: var(--font-size-body); }
}

</style>
