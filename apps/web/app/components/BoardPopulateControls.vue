<script setup lang="ts">
import type { BoardAssetScope } from '@content-library/shared'
import { Xmark } from 'reicon-vue'

interface Option { id: string; name: string }
interface Submitter { id: string; figma_handle: string | null; avatar_url: string | null }
interface MatchPreview { id: string; title: string; previewUrl: string; mime_type: string; width: number; height: number }
interface BoardFilters {
  search: string
  projectId: null
  tagId: null
  projectIds: string[]
  tagIds: string[]
  uploadedBy: null
  uploadedBys: string[]
  dateFrom: string | null
  dateTo: string | null
}

const props = defineProps<{
  visible: boolean
  boardId: string
  boardTitle: string
  projects: Option[]
  tags: Option[]
  submitters: Submitter[]
  assetScope: BoardAssetScope
  busy?: boolean
  error?: string
}>()
const emit = defineEmits<{
  close: []
  apply: [behavior: 'add' | 'automatic', filters: BoardFilters, assetScope: BoardAssetScope]
}>()

const search = ref('')
const projectIds = ref<string[]>([])
const tagIds = ref<string[]>([])
const uploadedBys = ref<string[]>([])
const dateFrom = ref('')
const dateTo = ref('')
const selectedAssetScope = ref<BoardAssetScope>('approved')
const choosingBehavior = ref(false)
const behavior = ref<'add' | 'automatic'>('add')
const matchCount = ref(0)
const matchPreviews = ref<MatchPreview[]>([])
const countLoading = ref(false)
const countError = ref('')
const decisionTitle = ref<HTMLElement>()
let countTimer: ReturnType<typeof setTimeout> | undefined
let countRequest = 0

const toIsoDate = (value: string, end = false) => value
  ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`).toISOString()
  : null
const filters = computed<BoardFilters>(() => ({
  search: search.value,
  projectId: null,
  tagId: null,
  projectIds: projectIds.value,
  tagIds: tagIds.value,
  uploadedBy: null,
  uploadedBys: uploadedBys.value,
  dateFrom: toIsoDate(dateFrom.value),
  dateTo: toIsoDate(dateTo.value, true)
}))
const setupHeading = computed(() => `Adding ${matchCount.value} ${matchCount.value === 1 ? 'asset' : 'assets'}`)

const loadMatchCount = async () => {
  if (!props.visible || !props.boardId) return
  const request = ++countRequest
  countLoading.value = true
  countError.value = ''
  try {
    const response = await $fetch<{ data: { count: number; previews: MatchPreview[] } }>(`/api/shares/${props.boardId}/matches`, {
      method: 'POST',
      body: { ...filters.value, assetScope: selectedAssetScope.value }
    })
    if (request === countRequest) {
      matchCount.value = response.data.count
      matchPreviews.value = response.data.previews
    }
  } catch {
    if (request === countRequest) countError.value = 'Unable to count matching assets.'
  } finally {
    if (request === countRequest) countLoading.value = false
  }
}
const scheduleMatchCount = () => {
  clearTimeout(countTimer)
  countTimer = setTimeout(loadMatchCount, 250)
}
const reset = () => {
  search.value = ''
  projectIds.value = []
  tagIds.value = []
  uploadedBys.value = []
  dateFrom.value = ''
  dateTo.value = ''
  selectedAssetScope.value = props.assetScope
  choosingBehavior.value = false
  behavior.value = 'add'
  matchCount.value = 0
  matchPreviews.value = []
  countError.value = ''
}
const clearFilters = () => {
  search.value = ''
  projectIds.value = []
  tagIds.value = []
  uploadedBys.value = []
  dateFrom.value = ''
  dateTo.value = ''
}
watch(() => props.visible, visible => {
  if (!visible) return
  reset()
  void loadMatchCount()
})
watch([filters, selectedAssetScope], scheduleMatchCount, { deep: true })
onBeforeUnmount(() => clearTimeout(countTimer))

const submit = async () => {
  if (!choosingBehavior.value) {
    choosingBehavior.value = true
    await nextTick()
    decisionTitle.value?.focus({ preventScroll: true })
    return
  }
  emit('apply', behavior.value, filters.value, selectedAssetScope.value)
}
const submitterName = (submitter: Submitter) => submitter.figma_handle || 'Unknown submitter'
const submitterInitial = (submitter: Submitter) => submitterName(submitter).trim().charAt(0).toLocaleUpperCase() || '?'
const toggleSubmitter = (submitterId: string) => {
  uploadedBys.value = uploadedBys.value.includes(submitterId)
    ? uploadedBys.value.filter(id => id !== submitterId)
    : [...uploadedBys.value, submitterId]
}
</script>

<template>
  <SelectionPanel :visible="visible" label="Add with filters" wide overlay raised @close="emit('close')">
    <Transition name="panel-step" mode="out-in">
      <AssetFilterControls
        v-if="!choosingBehavior"
        key="filters"
        v-model:search="search"
        v-model:project-ids="projectIds"
        v-model:tag-ids="tagIds"
        v-model:date-from="dateFrom"
        v-model:date-to="dateTo"
        :projects="projects"
        :tags="tags"
        show-search
        expanded
        :actions-visible="true"
        @submit="submit"
      >
        <template #before>
          <BoardAssetScopeControl v-model="selectedAssetScope" :disabled="busy" />
          <BoardFilterWidget
            :search="search"
            :project-ids="projectIds"
            :tag-ids="tagIds"
            :uploaded-bys="uploadedBys"
            :date-from="dateFrom"
            :date-to="dateTo"
            :projects="projects"
            :tags="tags"
            :submitters="submitters"
            :assets="matchPreviews"
            :loading="countLoading"
            show-previews
            :asset-scope="selectedAssetScope"
            clearable
            :disabled="busy"
            @clear="clearFilters"
          />
        </template>
        <template #after-tags>
          <section v-if="submitters.length" class="filter-option-group" role="group" aria-labelledby="board-populate-contributors">
            <h2 id="board-populate-contributors" class="filter-overlay-title">Contributor</h2>
            <div class="submitter-stack">
              <button
                v-for="submitter in submitters"
                :key="submitter.id"
                class="submitter-avatar"
                type="button"
                :aria-label="`Filter by ${submitterName(submitter)}`"
                :aria-pressed="uploadedBys.includes(submitter.id)"
                :title="submitterName(submitter)"
                @click="toggleSubmitter(submitter.id)"
              >
                <img v-if="submitter.avatar_url" :src="submitter.avatar_url" alt="">
                <span v-else aria-hidden="true">{{ submitterInitial(submitter) }}</span>
              </button>
            </div>
          </section>
        </template>
        <p v-if="countError" class="board-populate-error" role="alert">{{ countError }}</p>
        <template #actions>
          <button type="button" class="panel-secondary-action" @click="emit('close')">Cancel</button>
          <button class="panel-primary-action" type="submit" :disabled="countLoading || Boolean(countError)">Continue</button>
        </template>
      </AssetFilterControls>
      <AssetFilterControls
        v-else
        key="behavior"
        :project-ids="projectIds"
        :tag-ids="tagIds"
        :projects="projects"
        :tags="tags"
        :show-asset-filters="false"
        expanded
        :actions-visible="true"
        @submit="submit"
      >
        <section class="filter-option-group board-decision-intro">
          <h2 id="board-match-behavior-title" ref="decisionTitle" class="filter-overlay-title" tabindex="-1">{{ setupHeading }}</h2>
          <BoardMatchPreviews :assets="matchPreviews" />
        </section>
        <section class="filter-option-group panel-choice-list board-match-behavior" role="group" aria-labelledby="board-match-behavior-title">
          <button type="button" :aria-pressed="behavior === 'add'" @click="behavior = 'add'">
            <strong>Add assets and curate manually</strong>
            <span>Adds the current filter results once.</span>
          </button>
          <button type="button" :aria-pressed="behavior === 'automatic'" @click="behavior = 'automatic'">
            <strong>Add assets and update automatically</strong>
            <span>Keeps the board in sync with the current filters.</span>
          </button>
        </section>
        <p v-if="error" class="board-populate-error" role="alert">{{ error }}</p>
        <template #actions>
          <button type="button" class="panel-secondary-action" :disabled="busy" @click="choosingBehavior = false">Back</button>
          <button class="panel-primary-action" type="submit" :disabled="busy">{{ busy ? 'Applying…' : 'Apply to board' }}</button>
        </template>
      </AssetFilterControls>
    </Transition>
    <button class="filter-panel-toggle is-expanded" type="button" aria-label="Close add with filters" aria-expanded="true" @click="emit('close')">
      <Xmark :size="20" :stroke-width="2" aria-hidden="true" />
    </button>
  </SelectionPanel>
</template>

<style scoped>
.board-match-summary,
.board-decision-intro,
.board-match-behavior {
  display: grid;
  gap: var(--space);
}

.board-match-behavior{
 gap: var(--filter-option-gap);
}

.board-match-summary h3,
.board-match-behavior h3 {
  margin: 0;
  color: var(--filter-overlay-panel-color);
  font-size: var(--filter-caption-size);
  line-height: 1.2;
}

.board-decision-intro h2:focus { outline: none; }

.board-match-summary p,
.board-populate-error {
  margin: 0;
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-option-font-size);
}

.board-match-summary p.error,
.board-populate-error { color: var(--color-danger); }

.board-match-behavior strong { font-size: var(--filter-option-font-size); }
.board-match-behavior span {
  color: var(--filter-overlay-muted-color);
  font-size: var(--font-size-caption);
  letter-spacing: var(--letter-spacing-caption);
  line-height: 1.1;
}

</style>
