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
  assetScope: 'approved'
})

defineEmits<{ clear: [] }>()

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
const assetScopeLabel = computed(() => props.assetScope === 'all' ? 'all assets' : 'approved assets')
</script>

<template>
  <section class="filter-option-group board-filter-widget">
    <h2 class="filter-overlay-title board-filter-widget-title" aria-live="polite">
      <span>Show {{ assetScopeLabel }}</span>
      <template v-for="(cue, index) in cues" :key="cue.id">
        {{ ' ' }}<span class="board-filter-phrase">
          <span v-if="connector(cue, index)" class="board-filter-connector">{{ connector(cue, index) }}</span>
          <span class="board-filter-cue">
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
