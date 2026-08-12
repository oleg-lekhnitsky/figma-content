<script setup lang="ts">
interface Option { id: string; name: string }

withDefaults(defineProps<{
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
  showStatus?: boolean
  useDatePresets?: boolean
  showSort?: boolean
  expanded?: boolean
  heading?: string
  actionsVisible?: boolean
}>(), {
  search: '',
  status: '',
  dateRange: 'all',
  dateFrom: '',
  dateTo: '',
  sort: 'newest',
  showSearch: false,
  showStatus: false,
  useDatePresets: false,
  showSort: false,
  expanded: false,
  heading: '',
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
}>()

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
  <form class="asset-filter-controls" :class="{ 'asset-filter-controls--expanded': expanded }" aria-label="Filter assets" @submit.prevent>
    <template v-if="expanded">
      <h2 v-if="heading" class="filter-overlay-title">{{ heading }}</h2>
      <section v-if="showSearch" class="filter-option-group filter-search-group">
        <h3>Search</h3>
        <label class="filter-visible-search"><span class="sr-only">Search assets</span><input :value="search" type="search" placeholder="Type to search" @input="emit('update:search', ($event.target as HTMLInputElement).value)"></label>
      </section>
      <section v-if="showStatus" class="filter-option-group">
        <h3>Status</h3>
        <div class="filter-option-list"><button type="button" :aria-pressed="status === ''" @click="emit('update:status', '')">All</button><button type="button" :aria-pressed="status === 'approved'" @click="emit('update:status', 'approved')">Approved</button><button type="button" :aria-pressed="status === 'draft'" @click="emit('update:status', 'draft')">Draft</button></div>
      </section>
      <section class="filter-option-group">
        <h3>Projects</h3>
        <div class="filter-option-list"><button type="button" :aria-pressed="projectIds.length === 0" @click="emit('update:projectIds', [])">All</button><button v-for="option in projects" :key="option.id" type="button" :aria-pressed="projectIds.includes(option.id)" @click="emit('update:projectIds', toggleOption(projectIds, option.id))">{{ option.name }}</button></div>
      </section>
      <section class="filter-option-group">
        <h3>Tags</h3>
        <div class="filter-option-list"><button type="button" :aria-pressed="tagIds.length === 0" @click="emit('update:tagIds', [])">All</button><button v-for="option in tags" :key="option.id" type="button" :aria-pressed="tagIds.includes(option.id)" @click="emit('update:tagIds', toggleOption(tagIds, option.id))">{{ option.name }}</button></div>
      </section>
      <section class="filter-option-group">
        <h3>Date</h3>
        <div v-if="useDatePresets" class="filter-option-list"><button v-for="option in dateOptions" :key="option.value" type="button" :aria-pressed="dateRange === option.value" @click="emit('update:dateRange', option.value)">{{ option.label }}</button></div>
        <div v-if="!useDatePresets || dateRange === 'custom'" class="filter-date-range"><label><span>From</span><input :value="dateFrom" type="date" :max="dateTo || undefined" @input="emit('update:dateFrom', ($event.target as HTMLInputElement).value)"></label><label><span>To</span><input :value="dateTo" type="date" :min="dateFrom || undefined" @input="emit('update:dateTo', ($event.target as HTMLInputElement).value)"></label></div>
      </section>
      <section v-if="showSort" class="filter-option-group">
        <h3>Sort</h3>
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
      <label v-if="dateRange === 'custom'" class="date-field"><span>From</span><input :value="dateFrom" type="date" :max="dateTo || undefined" @input="$emit('update:dateFrom', ($event.target as HTMLInputElement).value)"></label>
      <label v-if="dateRange === 'custom'" class="date-field"><span>To</span><input :value="dateTo" type="date" :min="dateFrom || undefined" @input="$emit('update:dateTo', ($event.target as HTMLInputElement).value)"></label>
    </template>
    <template v-else>
      <label class="date-field"><span>From</span><input :value="dateFrom" type="date" :max="dateTo || undefined" @input="$emit('update:dateFrom', ($event.target as HTMLInputElement).value)"></label>
      <label class="date-field"><span>To</span><input :value="dateTo" type="date" :min="dateFrom || undefined" @input="$emit('update:dateTo', ($event.target as HTMLInputElement).value)"></label>
    </template>
    <label v-if="showSort" class="filter-dropdown"><span class="sr-only">Sort</span><select class="filter-dropdown-trigger" :value="sort" @change="$emit('update:sort', ($event.target as HTMLSelectElement).value)"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option><option value="title">Title</option><option value="dimensions">Dimensions</option><option value="submitter">Submitter</option></select><span class="filter-dropdown-chevron" aria-hidden="true" /></label>
    </template>
    <div v-if="$slots.actions" class="filter-actions" :class="{ 'is-visible': actionsVisible }" :aria-hidden="!actionsVisible" :inert="!actionsVisible"><slot name="actions" /></div>
    <slot />
  </form>
</template>

<style scoped>
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
</style>
