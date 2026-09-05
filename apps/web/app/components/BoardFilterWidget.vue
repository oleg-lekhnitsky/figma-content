<script setup lang="ts">
import type { BoardAssetScope } from '@content-library/shared'
import { Calendar, Folder, Hashtag, Search } from 'reicon-vue'

interface FilterOption { id: string; name: string }
interface FilterSubmitter { id: string; figma_handle: string | null; avatar_url: string | null }
interface MatchPreview { id: string; title: string; previewUrl: string; mime_type?: string | null; width: number; height: number }
interface FilterCue {
  id: string
  kind: 'search' | 'project' | 'tag' | 'submitter' | 'date'
  label: string
  avatarUrl?: string | null
  initial?: string
}

type QuickFilterKind = 'scope' | 'project' | 'tag' | 'submitter'

const props = withDefaults(defineProps<{
  search?: string
  projectIds?: string[]
  tagIds?: string[]
  uploadedBys?: string[]
  dateFrom?: string
  dateTo?: string
  projects?: FilterOption[]
  tags?: FilterOption[]
  submitters?: FilterSubmitter[]
  assets?: MatchPreview[]
  loading?: boolean
  showPreviews?: boolean
  clearable?: boolean
  disabled?: boolean
  interactive?: boolean
  assetScope?: BoardAssetScope
}>(), {
  search: '',
  projectIds: () => [],
  tagIds: () => [],
  uploadedBys: () => [],
  dateFrom: '',
  dateTo: '',
  projects: () => [],
  tags: () => [],
  submitters: () => [],
  assets: () => [],
  showPreviews: false,
  clearable: false,
  disabled: false,
  interactive: false,
  assetScope: 'approved'
})

const emit = defineEmits<{
  clear: []
  edit: [kind?: 'search']
  'update:assetScope': [value: BoardAssetScope]
  'update:projectIds': [value: string[]]
  'update:tagIds': [value: string[]]
  'update:uploadedBys': [value: string[]]
  'update:dateFrom': [value: string]
  'update:dateTo': [value: string]
}>()

const openQuickFilter = ref('')
const failedAvatars = ref(new Set<string>())
const setQuickFilterOpen = (id: string, open: boolean) => { openQuickFilter.value = open ? id : '' }
const toggleValue = (values: string[], id: string) => values.includes(id)
  ? values.filter(value => value !== id)
  : [...values, id]
const updateQuickFilter = (kind: QuickFilterKind, id: string) => {
  if (kind === 'scope') {
    emit('update:assetScope', id as BoardAssetScope)
    return
  }
  if (kind === 'project') emit('update:projectIds', id ? toggleValue(props.projectIds, id) : [])
  if (kind === 'tag') emit('update:tagIds', id ? toggleValue(props.tagIds, id) : [])
  if (kind === 'submitter') emit('update:uploadedBys', id ? toggleValue(props.uploadedBys, id) : [])
}
const quickFilterOptions = (kind: QuickFilterKind): Array<{ id: string; label: string; avatarUrl?: string | null }> => {
  if (kind === 'scope') return [
    { id: 'approved', label: 'Liked assets' },
    { id: 'all', label: 'Liked and draft assets' }
  ]
  if (kind === 'project') return [{ id: '', label: 'All projects' }, ...props.projects.map(option => ({ id: option.id, label: option.name }))]
  if (kind === 'tag') return [{ id: '', label: 'All tags' }, ...props.tags.map(option => ({ id: option.id, label: option.name }))]
  return [{ id: '', label: 'All submitters' }, ...props.submitters.map(option => ({ id: option.id, label: submitterName(option), avatarUrl: option.avatar_url }))]
}
const quickFilterSelected = (kind: QuickFilterKind, id: string) => {
  if (kind === 'scope') return props.assetScope === id
  const values = kind === 'project' ? props.projectIds : kind === 'tag' ? props.tagIds : props.uploadedBys
  return id ? values.includes(id) : values.length === 0
}
const quickDateEndpoint = computed(() => !props.dateFrom && props.dateTo ? 'to' : 'from')
const quickDateValue = computed(() => quickDateEndpoint.value === 'to' ? props.dateTo : props.dateFrom)
const updateQuickDate = (value: string) => {
  if (quickDateEndpoint.value === 'to') emit('update:dateTo', value)
  else emit('update:dateFrom', value)
}

const submitterName = (submitter: FilterSubmitter) => submitter.figma_handle || 'Unknown submitter'
const formatDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: year === new Date().getFullYear() ? undefined : 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, day)))
}
const cues = computed<FilterCue[]>(() => {
  const result: FilterCue[] = []
  if (props.search) result.push({ id: 'search', kind: 'search', label: `“${props.search}”` })
  if (!props.projectIds.length && props.projects.length) {
    result.push({ id: 'project-all', kind: 'project', label: 'all projects' })
  } else {
    props.projects
      .filter(option => props.projectIds.includes(option.id))
      .forEach(option => result.push({ id: `project-${option.id}`, kind: 'project', label: option.name }))
  }
  props.tags
    .filter(option => props.tagIds.includes(option.id))
    .forEach(option => result.push({ id: `tag-${option.id}`, kind: 'tag', label: option.name }))
  props.uploadedBys.forEach(submitterId => {
    const submitter = props.submitters.find(option => option.id === submitterId)
    const name = submitter ? submitterName(submitter) : 'Selected contributor'
    result.push({
      id: `submitter-${submitterId}`,
      kind: 'submitter',
      label: name,
      avatarUrl: submitter?.avatar_url,
      initial: name.charAt(0).toLocaleUpperCase()
    })
  })
  if (props.dateFrom && props.dateTo) result.push({ id: 'date', kind: 'date', label: `${formatDate(props.dateFrom)}–${formatDate(props.dateTo)}` })
  else if (props.dateFrom) result.push({ id: 'date', kind: 'date', label: `since ${formatDate(props.dateFrom)}` })
  else if (props.dateTo) result.push({ id: 'date', kind: 'date', label: `until ${formatDate(props.dateTo)}` })
  return result
})
const connector = (cue: FilterCue, index: number) => {
  if (index > 0 && cues.value[index - 1]?.kind === cue.kind) return ''
  if (cue.kind === 'search') return 'matching'
  if (cue.kind === 'project') return 'in'
  if (cue.kind === 'tag') return cues.value.some(item => item.kind === 'project') ? 'with' : 'tagged'
  if (cue.kind === 'submitter') return cues.value.filter(item => item.kind === 'submitter').length > 1 ? 'from' : 'by'
  return ''
}
const hasFilters = computed(() => Boolean(
  props.search || props.projectIds.length || props.tagIds.length || props.uploadedBys.length || props.dateFrom || props.dateTo
))
const assetScopeLabel = computed(() => props.assetScope === 'all' ? 'all assets' : 'liked assets')
</script>

<template>
  <section class="filter-option-group board-filter-widget">
    <h2 class="filter-overlay-title board-filter-widget-title" aria-live="polite">
      <AppDropdownMenu
        v-if="interactive"
        :open="openQuickFilter === 'scope'"
        content-class="panel-dropdown-menu board-filter-quick-menu"
        @update:open="setQuickFilterOpen('scope', $event)"
      >
        <template #trigger="{ triggerProps }">
          <button v-bind="triggerProps" class="board-filter-scope-trigger" type="button">Show {{ assetScopeLabel }}</button>
        </template>
        <button
          v-for="option in quickFilterOptions('scope')"
          :key="option.id"
          role="menuitemradio"
          type="button"
          :aria-checked="quickFilterSelected('scope', option.id)"
          @click="updateQuickFilter('scope', option.id)"
        >{{ option.label }}</button>
      </AppDropdownMenu>
      <span v-else>Show {{ assetScopeLabel }}</span>
      <template v-for="(cue, index) in cues" :key="cue.id">
        {{ ' ' }}<span class="board-filter-phrase">
          <span v-if="connector(cue, index)" class="board-filter-connector">{{ connector(cue, index) }}</span>
          <AppDropdownMenu
            v-if="interactive && ['project', 'tag', 'submitter'].includes(cue.kind)"
            :open="openQuickFilter === cue.id"
            content-class="panel-dropdown-menu board-filter-quick-menu"
            @update:open="setQuickFilterOpen(cue.id, $event)"
          >
            <template #trigger="{ triggerProps }">
              <button v-bind="triggerProps" class="board-filter-cue" type="button">
                <Folder v-if="cue.kind === 'project'" :size="16" :stroke-width="2" aria-hidden="true" />
                <Hashtag v-else-if="cue.kind === 'tag'" :size="16" :stroke-width="2" aria-hidden="true" />
                <span v-else class="board-filter-cue-avatar" aria-hidden="true">
                  <img v-if="cue.avatarUrl" :src="cue.avatarUrl" alt="">
                  <span v-else>{{ cue.initial }}</span>
                </span>
                <span>{{ cue.label }}</span>
              </button>
            </template>
            <button
              v-for="option in quickFilterOptions(cue.kind as QuickFilterKind)"
              :key="option.id"
              role="menuitemcheckbox"
              type="button"
              data-menu-close="false"
              :class="{ 'board-filter-submitter-option': cue.kind === 'submitter' }"
              :aria-checked="quickFilterSelected(cue.kind as QuickFilterKind, option.id)"
              @click="updateQuickFilter(cue.kind as QuickFilterKind, option.id)"
            >
              <span v-if="cue.kind === 'submitter' && option.id" class="board-filter-option-avatar" :data-initial="option.label.trim().charAt(0).toLocaleUpperCase()" aria-hidden="true">
                <img v-if="option.avatarUrl && !failedAvatars.has(option.avatarUrl)" :src="option.avatarUrl" alt="" @error="failedAvatars.add(option.avatarUrl)">
              </span>
              <span>{{ option.label }}</span>
            </button>
          </AppDropdownMenu>
          <AppDatePicker
            v-else-if="interactive && cue.kind === 'date'"
            class="board-filter-quick-date"
            :model-value="quickDateValue"
            :label="quickDateEndpoint === 'to' ? 'To' : 'From'"
            :min="quickDateEndpoint === 'to' ? dateFrom : ''"
            :max="quickDateEndpoint === 'from' ? dateTo : ''"
            :show-label="false"
            @update:model-value="updateQuickDate"
          >
            <template #trigger="{ triggerProps }">
              <button v-bind="triggerProps" class="board-filter-cue" type="button" :aria-label="`Change date filter: ${cue.label}`">
                <Calendar :size="16" :stroke-width="2" aria-hidden="true" />
                <span>{{ cue.label }}</span>
              </button>
            </template>
          </AppDatePicker>
          <button v-else-if="interactive" class="board-filter-cue" type="button" @click="emit('edit', 'search')">
            <Search :size="16" :stroke-width="2" aria-hidden="true" />
            <span>{{ cue.label }}</span>
          </button>
          <span v-else class="board-filter-cue">
            <Search v-if="cue.kind === 'search'" :size="16" :stroke-width="2" aria-hidden="true" />
            <Folder v-else-if="cue.kind === 'project'" :size="16" :stroke-width="2" aria-hidden="true" />
            <Hashtag v-else-if="cue.kind === 'tag'" :size="16" :stroke-width="2" aria-hidden="true" />
            <span v-else-if="cue.kind === 'submitter'" class="board-filter-cue-avatar" aria-hidden="true">
              <img v-if="cue.avatarUrl" :src="cue.avatarUrl" alt="">
              <span v-else>{{ cue.initial }}</span>
            </span>
            <Calendar v-else :size="16" :stroke-width="2" aria-hidden="true" />
            <span>{{ cue.label }}</span>
          </span>
        </span>
      </template>
    </h2>
    <BoardMatchPreviews v-if="showPreviews" :assets="assets" :loading="loading" />
    <button v-if="clearable && hasFilters" class="panel-secondary-action" type="button" :disabled="disabled" @click="$emit('clear')">Clear filters</button>
    <slot />
  </section>
</template>

<style scoped>
.board-filter-submitter-option {
  gap: .5em;
}

.board-filter-option-avatar {
  position: relative;
  margin-inline-start: -.375em;
  width: 1.5em;
  height: 1.5em;
  flex: 0 0 1.5em;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: color-mix(in srgb, currentColor 14%, transparent);
}

.board-filter-option-avatar::before {
  content: attr(data-initial);
  font-size: .72em;
}

.board-filter-option-avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

button.board-filter-cue {
  min-height: 0;
  cursor: pointer;
}

.board-filter-widget-title :deep(.app-popover) {
  display: inline;
}

.board-filter-quick-date {
  display: inline;
}

.board-filter-scope-trigger {
  min-height: 0;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  line-height: inherit;
  text-align: start;
  vertical-align: baseline;
}

.board-filter-scope-trigger:is(:hover, :focus-visible),
button.board-filter-cue:is(:hover, :focus-visible) {
  opacity: .72;
}
</style>
