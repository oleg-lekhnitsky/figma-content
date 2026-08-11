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
  showSort: false
})

defineEmits<{
  'update:search': [value: string]
  'update:status': [value: string]
  'update:projectIds': [value: string[]]
  'update:tagIds': [value: string[]]
  'update:dateRange': [value: string]
  'update:dateFrom': [value: string]
  'update:dateTo': [value: string]
  'update:sort': [value: string]
}>()
</script>

<template>
  <form class="asset-filter-controls" aria-label="Filter assets" @submit.prevent>
    <label v-if="showSearch" class="search-field"><span class="sr-only">Search assets</span><input :value="search" type="search" placeholder="Search" @input="$emit('update:search', ($event.target as HTMLInputElement).value)"></label>
    <label v-if="showStatus"><span class="sr-only">Status</span><select :value="status" @change="$emit('update:status', ($event.target as HTMLSelectElement).value)"><option value="">All statuses</option><option value="approved">Approved</option><option value="draft">Draft</option></select></label>
    <FilterMultiSelect :model-value="projectIds" label="Projects" :options="projects" @update:model-value="$emit('update:projectIds', $event)" />
    <FilterMultiSelect :model-value="tagIds" label="Tags" :options="tags" @update:model-value="$emit('update:tagIds', $event)" />
    <template v-if="useDatePresets">
      <label><span class="sr-only">Date</span><select :value="dateRange" @change="$emit('update:dateRange', ($event.target as HTMLSelectElement).value)"><option value="all">All dates</option><option value="today">Today</option><option value="week">This week</option><option value="two-weeks">Last two weeks</option><option value="month">This month</option><option value="custom">Custom range</option></select></label>
      <label v-if="dateRange === 'custom'" class="date-field"><span>From</span><input :value="dateFrom" type="date" :max="dateTo || undefined" @input="$emit('update:dateFrom', ($event.target as HTMLInputElement).value)"></label>
      <label v-if="dateRange === 'custom'" class="date-field"><span>To</span><input :value="dateTo" type="date" :min="dateFrom || undefined" @input="$emit('update:dateTo', ($event.target as HTMLInputElement).value)"></label>
    </template>
    <template v-else>
      <label class="date-field"><span>From</span><input :value="dateFrom" type="date" :max="dateTo || undefined" @input="$emit('update:dateFrom', ($event.target as HTMLInputElement).value)"></label>
      <label class="date-field"><span>To</span><input :value="dateTo" type="date" :min="dateFrom || undefined" @input="$emit('update:dateTo', ($event.target as HTMLInputElement).value)"></label>
    </template>
    <label v-if="showSort"><span class="sr-only">Sort</span><select :value="sort" @change="$emit('update:sort', ($event.target as HTMLSelectElement).value)"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option><option value="title">Title</option><option value="dimensions">Dimensions</option><option value="submitter">Submitter</option></select></label>
    <slot />
  </form>
</template>

<style scoped>
.asset-filter-controls{width:max-content;min-height:36px;display:flex;align-items:center;gap:calc(var(--space)/4)}
label{position:relative;width:max-content;height:36px}
:is(input,select){box-sizing:border-box;width:auto;min-width:0;max-width:11rem;height:36px;min-height:36px;padding:0 calc(var(--space)*1.5) 0 calc(var(--space)/2);border:0;border-radius:999px;appearance:none;color:var(--color-fg);background:var(--color-surface);font:inherit;font-size:13px}
.search-field input{padding-inline:calc(var(--space)/2)}
input[type='search']::-webkit-search-cancel-button{appearance:none}
label:not(.search-field):not(.date-field)::after{content:"";position:absolute;top:12px;right:calc(var(--space)/2);width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);pointer-events:none}
:is(input,select):focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.date-field span{position:absolute;z-index:1;top:3px;left:calc(var(--space)/2);color:var(--color-muted);font-size:10px;pointer-events:none}
.date-field input{padding:11px calc(var(--space)/2) 0;appearance:auto}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
:deep(.multi-select-trigger){flex:0 0 auto}
@media(max-width:520px){.asset-filter-controls{min-height:44px}.asset-filter-controls label,:is(input,select),:deep(.multi-select-trigger){height:44px;min-height:44px}.search-field{flex:1 1 auto}.search-field input{width:100%;max-width:none;font-size:16px}}
</style>
