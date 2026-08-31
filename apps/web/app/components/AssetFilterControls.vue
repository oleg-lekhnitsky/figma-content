<script setup lang="ts">
interface Option { id: string; name: string }

const props = withDefaults(defineProps<{
  search?: string
  status?: string
  projectIds: string[]
  tagIds: string[]
  dateRange?: string
  dateFrom?: string
  dateTo?: string
  sort?: string
  projects: Option[]
  tags: Option[]
  showSearch?: boolean
  showAssetFilters?: boolean
  showStatus?: boolean
  useDatePresets?: boolean
  showSort?: boolean
  expanded?: boolean
  heading?: string
  description?: string
  actionsVisible?: boolean
}>(), {
  search: '',
  status: '',
  dateRange: 'all',
  dateFrom: '',
  dateTo: '',
  sort: 'newest',
  showSearch: false,
  showAssetFilters: true,
  showStatus: false,
  useDatePresets: false,
  showSort: false,
  expanded: false,
  heading: '',
  description: '',
  actionsVisible: false
})

const emit = defineEmits<{
  'update:search': [value: string]
  'update:status': [value: string]
  'update:projectIds': [value: string[]]
  'update:tagIds': [value: string[]]
  'update:dateRange': [value: string]
  'update:dateFrom': [value: string]
  'update:dateTo': [value: string]
  'update:sort': [value: string]
  submit: []
}>()

const sheetContent = ref<HTMLElement | null>(null)
let revealTimer: ReturnType<typeof setTimeout> | undefined
const keepFocusedFilterVisible = () => {
  const content = sheetContent.value
  const focused = document.activeElement
  if (!content || !(focused instanceof HTMLElement) || !content.contains(focused)) return
  const contentRect = content.getBoundingClientRect()
  const focusedRect = focused.getBoundingClientRect()
  const inset = 8
  const delta = focusedRect.bottom > contentRect.bottom - inset
    ? focusedRect.bottom - contentRect.bottom + inset
    : focusedRect.top < contentRect.top + inset
      ? focusedRect.top - contentRect.top - inset
      : 0
  if (!delta) return
  content.scrollBy({
    top: delta,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  })
}
watch(() => props.actionsVisible, async (visible, wasVisible) => {
  if (!visible || wasVisible) return
  await nextTick()
  requestAnimationFrame(keepFocusedFilterVisible)
  clearTimeout(revealTimer)
  revealTimer = setTimeout(keepFocusedFilterVisible, 280)
})
onBeforeUnmount(() => clearTimeout(revealTimer))

const toggleOption = (values: string[], id: string) => values.includes(id) ? values.filter(value => value !== id) : [...values, id]
const dateOptions = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'two-weeks', label: 'Last two weeks' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' }
]
const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'updated', label: 'Updated' },
  { value: 'title', label: 'Title' },
  { value: 'dimensions', label: 'Dimensions' },
  { value: 'submitter', label: 'Submitter' }
]
</script>

<template>
  <form class="asset-filter-controls asset-filter-controls--filters" :class="{ 'asset-filter-controls--expanded': expanded }" aria-label="Filter assets" @submit.prevent="emit('submit')">
    <button v-if="expanded" class="filter-sheet-handle" type="button" aria-label="Close filters"><span aria-hidden="true" /></button>
    <div ref="sheetContent" class="filter-sheet-content">
      <template v-if="expanded">
      <div v-if="heading && description" class="board-settings-intro"><h2 class="filter-overlay-title">{{ heading }}</h2><p class="board-type-summary">{{ description }}</p></div>
      <h2 v-else-if="heading" class="filter-overlay-title">{{ heading }}</h2>
      <slot name="before" />
      <section v-if="showSearch" class="filter-option-group filter-search-group">
        <label><span class="sr-only">Search assets</span><input class="panel-field" :value="search" type="search" placeholder="Type to search" @input="emit('update:search', ($event.target as HTMLInputElement).value)"></label>
      </section>
      <section v-if="showStatus" class="filter-option-group">
        <h2 class="filter-overlay-title">Status</h2>
        <div class="filter-option-list filter-option-list--segmented"><button type="button" :aria-pressed="status === ''" @click="emit('update:status', '')">All</button><button type="button" :aria-pressed="status === 'approved'" @click="emit('update:status', 'approved')">Approved</button><button type="button" :aria-pressed="status === 'draft'" @click="emit('update:status', 'draft')">Draft</button></div>
      </section>
      <section v-if="showAssetFilters" class="filter-option-group">
        <h2 class="filter-overlay-title">Projects</h2>
        <div class="filter-option-list"><button type="button" :aria-pressed="projectIds.length === 0" @click="emit('update:projectIds', [])">All</button><button v-for="option in projects" :key="option.id" type="button" :aria-pressed="projectIds.includes(option.id)" @click="emit('update:projectIds', toggleOption(projectIds, option.id))">{{ option.name }}</button></div>
      </section>
      <section v-if="showAssetFilters" class="filter-option-group">
        <h2 class="filter-overlay-title">Tags</h2>
        <div class="filter-option-list"><button type="button" :aria-pressed="tagIds.length === 0" @click="emit('update:tagIds', [])">All</button><button v-for="option in tags" :key="option.id" type="button" :aria-pressed="tagIds.includes(option.id)" @click="emit('update:tagIds', toggleOption(tagIds, option.id))">{{ option.name }}</button></div>
      </section>
      <section v-if="showAssetFilters" class="filter-option-group">
        <h2 class="filter-overlay-title">Date</h2>
        <div v-if="useDatePresets" class="filter-option-list"><button v-for="option in dateOptions" :key="option.value" type="button" :aria-pressed="dateRange === option.value" @click="emit('update:dateRange', option.value)">{{ option.label }}</button></div>
        <div v-if="!useDatePresets || dateRange === 'custom'" class="filter-date-range">
          <AppDatePicker :model-value="dateFrom" label="From" :max="dateTo" surface="field" @update:model-value="emit('update:dateFrom', $event)" />
          <AppDatePicker :model-value="dateTo" label="To" :min="dateFrom" surface="field" @update:model-value="emit('update:dateTo', $event)" />
        </div>
      </section>
      <section v-if="showSort" class="filter-option-group">
        <h2 class="filter-overlay-title">Sort</h2>
        <div class="filter-option-list"><button v-for="option in sortOptions" :key="option.value" type="button" :aria-pressed="sort === option.value" @click="emit('update:sort', option.value)">{{ option.label }}</button></div>
      </section>
      </template>
      <template v-else>
      <label v-if="showSearch" class="search-field"><span class="sr-only">Search assets</span><input :value="search" type="search" placeholder="Search" @input="$emit('update:search', ($event.target as HTMLInputElement).value)"></label>
    <label v-if="showStatus" class="filter-dropdown"><span class="sr-only">Status</span><select class="filter-dropdown-trigger" :value="status" @change="$emit('update:status', ($event.target as HTMLSelectElement).value)"><option value="">All statuses</option><option value="approved">Approved</option><option value="draft">Draft</option></select><span class="filter-dropdown-chevron" aria-hidden="true" /></label>
    <FilterMultiSelect :model-value="projectIds" label="Projects" :options="projects" @update:model-value="$emit('update:projectIds', $event)" />
    <FilterMultiSelect :model-value="tagIds" label="Tags" :options="tags" @update:model-value="$emit('update:tagIds', $event)" />
    <template v-if="useDatePresets">
      <label class="filter-dropdown"><span class="sr-only">Date</span><select class="filter-dropdown-trigger" :value="dateRange" @change="$emit('update:dateRange', ($event.target as HTMLSelectElement).value)"><option value="all">All dates</option><option value="today">Today</option><option value="week">This week</option><option value="two-weeks">Last two weeks</option><option value="month">This month</option><option value="custom">Custom range</option></select><span class="filter-dropdown-chevron" aria-hidden="true" /></label>
      <AppDatePicker v-if="dateRange === 'custom'" :model-value="dateFrom" label="From" :max="dateTo" @update:model-value="$emit('update:dateFrom', $event)" />
      <AppDatePicker v-if="dateRange === 'custom'" :model-value="dateTo" label="To" :min="dateFrom" @update:model-value="$emit('update:dateTo', $event)" />
    </template>
    <template v-else>
      <AppDatePicker :model-value="dateFrom" label="From" :max="dateTo" @update:model-value="$emit('update:dateFrom', $event)" />
      <AppDatePicker :model-value="dateTo" label="To" :min="dateFrom" @update:model-value="$emit('update:dateTo', $event)" />
    </template>
    <label v-if="showSort" class="filter-dropdown"><span class="sr-only">Sort</span><select class="filter-dropdown-trigger" :value="sort" @change="$emit('update:sort', ($event.target as HTMLSelectElement).value)"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option><option value="title">Title</option><option value="dimensions">Dimensions</option><option value="submitter">Submitter</option></select><span class="filter-dropdown-chevron" aria-hidden="true" /></label>
      </template>
      <slot />
    </div>
    <div v-if="$slots.actions" class="filter-actions" :class="{ 'is-visible': actionsVisible }" :aria-hidden="!actionsVisible" :inert="!actionsVisible"><slot name="actions" /></div>
  </form>
</template>

<style scoped>
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
</style>
