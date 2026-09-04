<script setup lang="ts">
import type { BoardAssetScope, BoardLayout } from '@content-library/shared'
import CopyLinkIcon from '~/components/CopyLinkIcon.vue'
import OpenLinkIcon from '~/components/OpenLinkIcon.vue'
import { boardLayoutOptions } from '../utils/board-layouts'

interface FilterOption { id: string; name: string }
interface FilterSubmitter { id: string; figma_handle: string | null; avatar_url: string | null }
interface MatchPreview { id: string; title: string; previewUrl: string; mime_type?: string | null; width: number; height: number }

const props = defineProps<{
  title: string
  boardId: string
  purpose: 'showcase' | 'review' | 'portfolio' | 'case'
  portfolioKind?: 'main' | 'client' | null
  portfolioClient?: string | null
  mode: 'dynamic' | 'static'
  assetScope: BoardAssetScope
  projectBacked?: boolean
  editFiltersOnOpen?: boolean
  layout: BoardLayout
  publicationEnabled: boolean
  canEdit?: boolean
  canManageMembers?: boolean
  busy?: boolean
  publicUrl: string
  fullSettingsUrl: string
  filterSearch: string
  filterProjectIds: string[]
  filterTagIds: string[]
  filterUploadedBys: string[]
  filterDateFrom: string
  filterDateTo: string
  projects: FilterOption[]
  tags: FilterOption[]
  submitters: FilterSubmitter[]
  members: Array<{ user_id: string; role: string; allowed_users: { email: string | null; figma_handle: string | null; avatar_url: string | null } | null }>
  workspaceMembers: Array<{ id: string; email: string | null; figma_handle: string | null; avatar_url: string | null; role: string }>
  feedback?: string
  error?: boolean
}>()

const selectedMemberId = ref('')
type BoardMemberRole = 'editor' | 'contributor' | 'viewer'
const memberRole = ref<BoardMemberRole>('contributor')
const memberRoleOpen = ref(false)
const memberPickerOpen = ref(false)
const memberRowRoleOpen = ref('')
const memberRowActionOpen = ref('')
const memberRoleOptions = [
  { value: 'viewer', label: 'Viewer', description: 'View this board.' },
  { value: 'contributor', label: 'Contributor', description: 'Add and manage their own assets.' },
  { value: 'editor', label: 'Editor', description: 'Manage the board and all of its assets.' }
] as const
const availableWorkspaceMembers = computed(() => {
  const assignedIds = new Set(props.members.map(member => member.user_id))
  return props.workspaceMembers.filter(member => !assignedIds.has(member.id) && Boolean(member.email))
})
const workspaceMemberOptions = computed(() => availableWorkspaceMembers.value.map(member => ({
  value: member.id,
  label: member.email ?? member.figma_handle ?? 'Workspace member',
  description: `${member.role.charAt(0).toUpperCase()}${member.role.slice(1)} workspace member`
})))
const selectedWorkspaceMember = computed(() => availableWorkspaceMembers.value.find(member => member.id === selectedMemberId.value))
watch(availableWorkspaceMembers, members => {
  if (!members.some(member => member.id === selectedMemberId.value)) selectedMemberId.value = members[0]?.id ?? ''
}, { immediate: true })
const setMemberRole = (role: string) => { memberRole.value = role as BoardMemberRole }
const memberName = (member: typeof props.members[number]) => member.allowed_users?.email ?? member.allowed_users?.figma_handle ?? 'Workspace member'
const memberInitial = (member: typeof props.members[number]) => memberName(member).trim().charAt(0).toLocaleUpperCase() || '?'
const submitterName = (submitter: FilterSubmitter) => submitter.figma_handle || 'Unknown submitter'
const submitterInitial = (submitter: FilterSubmitter) => submitterName(submitter).trim().charAt(0).toLocaleUpperCase() || '?'
const addingMember = ref(false)
const emit = defineEmits<{
  setPublication: [enabled: boolean]
  setLayout: [layout: BoardLayout]
  setAssetScope: [scope: BoardAssetScope]
  'update:filterSearch': [value: string]
  'update:filterProjectIds': [value: string[]]
  'update:filterTagIds': [value: string[]]
  'update:filterUploadedBys': [value: string[]]
  'update:filterDateFrom': [value: string]
  'update:filterDateTo': [value: string]
  copyLink: []
  saveMember: [email: string, role: BoardMemberRole]
  removeMember: [userId: string]
  deleteBoard: []
  dismissFeedback: []
}>()
const updateExistingMember = (member: typeof props.members[number], role: string) => {
  const email = member.allowed_users?.email
  if (!email || member.role === 'owner') return
  memberRowRoleOpen.value = ''
  emit('saveMember', email, role as BoardMemberRole)
}
const removeExistingMember = (member: typeof props.members[number]) => {
  memberRowActionOpen.value = ''
  emit('removeMember', member.user_id)
}
const toggleFilterOption = (values: string[], id: string) => values.includes(id)
  ? values.filter(value => value !== id)
  : [...values, id]
const editingFilters = ref(false)
const filterDraft = reactive({
  search: '',
  projectIds: [] as string[],
  tagIds: [] as string[],
  uploadedBys: [] as string[],
  dateFrom: '',
  dateTo: '',
  assetScope: 'approved' as BoardAssetScope
})
const draftMatchPreviews = ref<MatchPreview[]>([])
const draftMatchLoading = ref(false)
let draftMatchTimer: ReturnType<typeof setTimeout> | undefined
let draftMatchRequest = 0
const toIsoDate = (value: string, end = false) => value
  ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`).toISOString()
  : null
const loadDraftMatches = async () => {
  if (!editingFilters.value || !props.boardId) return
  const request = ++draftMatchRequest
  draftMatchLoading.value = true
  try {
    const response = await $fetch<{ data: { previews: MatchPreview[] } }>(`/api/shares/${props.boardId}/matches`, {
      method: 'POST',
      body: {
        search: filterDraft.search,
        projectId: null,
        tagId: null,
        projectIds: filterDraft.projectIds,
        tagIds: filterDraft.tagIds,
        uploadedBy: null,
        uploadedBys: filterDraft.uploadedBys,
        dateFrom: toIsoDate(filterDraft.dateFrom),
        dateTo: toIsoDate(filterDraft.dateTo, true),
        assetScope: filterDraft.assetScope
      }
    })
    if (request === draftMatchRequest) draftMatchPreviews.value = response.data.previews
  } catch {
    if (request === draftMatchRequest) draftMatchPreviews.value = []
  } finally {
    if (request === draftMatchRequest) draftMatchLoading.value = false
  }
}
const scheduleDraftMatches = () => {
  clearTimeout(draftMatchTimer)
  draftMatchRequest += 1
  draftMatchLoading.value = true
  draftMatchTimer = setTimeout(loadDraftMatches, 250)
}
const resetFilterDraft = () => {
  filterDraft.search = props.filterSearch
  filterDraft.projectIds = [...props.filterProjectIds]
  filterDraft.tagIds = [...props.filterTagIds]
  filterDraft.uploadedBys = [...props.filterUploadedBys]
  filterDraft.dateFrom = props.filterDateFrom
  filterDraft.dateTo = props.filterDateTo
  filterDraft.assetScope = props.assetScope
}
const controlsRoot = ref<HTMLElement | null>(null)
const beginEditingFilters = async (focus?: 'search') => {
  resetFilterDraft()
  editingFilters.value = true
  if (!focus) return
  await nextTick()
  requestAnimationFrame(() => {
    controlsRoot.value?.querySelector<HTMLInputElement>('#board-filter-search')?.focus()
  })
}
watch(() => [props.title, props.projectBacked], () => { editingFilters.value = false })
watch(() => props.editFiltersOnOpen, value => {
  if (value && props.mode === 'dynamic' && !props.projectBacked) beginEditingFilters()
  else if (!value) editingFilters.value = false
}, { immediate: true })
watch(() => [
  editingFilters.value,
  filterDraft.search,
  filterDraft.projectIds.join(','),
  filterDraft.tagIds.join(','),
  filterDraft.uploadedBys.join(','),
  filterDraft.dateFrom,
  filterDraft.dateTo,
  filterDraft.assetScope
], ([editing]) => {
  if (editing) scheduleDraftMatches()
  else {
    clearTimeout(draftMatchTimer)
    draftMatchRequest += 1
    draftMatchLoading.value = false
    draftMatchPreviews.value = []
  }
}, { immediate: true })
const clearDraftFilters = () => {
  filterDraft.search = ''
  filterDraft.projectIds = []
  filterDraft.tagIds = []
  filterDraft.uploadedBys = []
  filterDraft.dateFrom = ''
  filterDraft.dateTo = ''
}
const toggleSubmitterFilter = (submitterId: string) => {
  filterDraft.uploadedBys = toggleFilterOption(filterDraft.uploadedBys, submitterId)
}
const applyFilterDraft = () => {
  if (filterDraft.assetScope !== props.assetScope) emit('setAssetScope', filterDraft.assetScope)
  emit('update:filterSearch', filterDraft.search)
  emit('update:filterProjectIds', [...filterDraft.projectIds])
  emit('update:filterTagIds', [...filterDraft.tagIds])
  emit('update:filterUploadedBys', [...filterDraft.uploadedBys])
  emit('update:filterDateFrom', filterDraft.dateFrom)
  emit('update:filterDateTo', filterDraft.dateTo)
  editingFilters.value = false
}
const submitMember = () => {
  const email = selectedWorkspaceMember.value?.email?.trim()
  if (!email) return
  emit('saveMember', email, memberRole.value)
  addingMember.value = false
}
const toggleMemberForm = () => {
  addingMember.value = !addingMember.value
  if (addingMember.value) selectedMemberId.value = availableWorkspaceMembers.value[0]?.id ?? ''
}

let feedbackTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.feedback, feedback => {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  if (!feedback) return
  feedbackTimer = setTimeout(() => emit('dismissFeedback'), 2500)
})
onBeforeUnmount(() => {
  clearTimeout(draftMatchTimer)
  if (feedbackTimer) clearTimeout(feedbackTimer)
})
</script>

<template>
  <div ref="controlsRoot" class="asset-filter-controls asset-filter-controls--expanded board-settings-controls">
    <button class="filter-sheet-handle" type="button" aria-label="Close board settings"><span aria-hidden="true" /></button>
    <Transition name="panel-step" mode="out-in">
    <div :key="editingFilters ? 'filters' : 'settings'" class="filter-sheet-content">
    <template v-if="!editingFilters">
    <section class="filter-option-group board-settings-intro">
      <h2 class="filter-overlay-title">{{ title }}</h2>
      <p class="board-type-summary"><template v-if="projectBacked"><strong>Smart board.</strong> {{ assetScope === 'all' ? 'Approved and draft assets' : 'Approved assets' }} from this project appear automatically.</template><template v-else-if="mode === 'dynamic'"><strong>Smart board.</strong> <br>Matching assets appear automatically based on rules.</template><template v-else>Add and arrange assets yourself.</template></p>
    </section>

    <BoardAssetScopeControl v-if="purpose !== 'review' && (mode !== 'dynamic' || projectBacked)" :model-value="assetScope" :disabled="!canEdit || busy" :description="assetScope === 'all' ? publicationEnabled ? 'Approved and draft assets are visible here and on the public board. Archived assets stay hidden.' : 'Shows approved and draft assets. Archived assets stay hidden.' : 'Shows approved assets only.'" @update:model-value="$emit('setAssetScope', $event)" />

    <BoardFilterWidget v-if="mode === 'dynamic'" class="board-filter-settings" :search="filterSearch" :project-ids="filterProjectIds" :tag-ids="filterTagIds" :uploaded-bys="filterUploadedBys" :date-from="filterDateFrom" :date-to="filterDateTo" :projects="projects" :tags="tags" :submitters="submitters" :asset-scope="assetScope" :interactive="canEdit && !projectBacked && !busy"
      @update:asset-scope="$emit('setAssetScope', $event)" @update:project-ids="$emit('update:filterProjectIds', $event)" @update:tag-ids="$emit('update:filterTagIds', $event)" @update:uploaded-bys="$emit('update:filterUploadedBys', $event)" @update:date-from="$emit('update:filterDateFrom', $event)" @update:date-to="$emit('update:filterDateTo', $event)" @edit="beginEditingFilters">
      <button v-if="canEdit && !projectBacked" class="panel-secondary-action" type="button" :disabled="busy" @click="beginEditingFilters()">Change filters</button>
    </BoardFilterWidget>

    <section class="filter-option-group board-public-access" role="group" aria-labelledby="board-public-access">
      <div class="board-public-access-heading">
        <h2 id="board-public-access" class="filter-overlay-title">Public access</h2>
        <Transition name="public-access-actions">
          <span v-if="publicationEnabled && publicUrl" class="public-access-actions">
            <a class="public-access-icon" :href="publicUrl" target="_blank" rel="noopener" aria-label="Open public page in a new tab" title="Open public page"><OpenLinkIcon aria-hidden="true" /></a>
            <button class="public-access-icon" type="button" aria-label="Copy public link" title="Copy public link" @click="$emit('copyLink')"><CopyLinkIcon aria-hidden="true" /></button>
          </span>
        </Transition>
      </div>
      <div class="filter-option-list filter-option-list--segmented">
        <button type="button" :aria-pressed="!publicationEnabled" :disabled="!canEdit || busy" @click="$emit('setPublication', false)">Unpublished</button>
        <button type="button" :aria-pressed="publicationEnabled" :disabled="!canEdit || busy" @click="$emit('setPublication', true)">Published</button>
      </div>
    </section>

    <section v-if="purpose === 'portfolio'" class="filter-option-group portfolio-summary" aria-labelledby="board-portfolio">
      <h2 id="board-portfolio" class="filter-overlay-title">Portfolio</h2>
      <p class="board-type-summary">{{ portfolioKind === 'main' ? 'Main portfolio' : portfolioClient ? `Client portfolio · ${portfolioClient}` : 'Client portfolio' }}</p>
      <NuxtLink class="panel-secondary-action" :to="fullSettingsUrl">Manage portfolio</NuxtLink>
    </section>

    <div v-else-if="purpose === 'review'" class="board-settings-actions">
      <NuxtLink class="button" :to="fullSettingsUrl">Open review workspace</NuxtLink>
    </div>

    <section class="filter-option-group" role="group" aria-labelledby="board-public-layout">
      <h2 id="board-public-layout" class="filter-overlay-title">Public layout</h2>
      <div class="filter-option-list filter-option-list--segmented">
        <button v-for="option in boardLayoutOptions" :key="option.value" type="button" :aria-pressed="layout === option.value" :disabled="!canEdit || busy" @click="$emit('setLayout', option.value)">{{ option.label }}</button>
      </div>
    </section>

    <section class="filter-option-group board-members" aria-labelledby="board-roles">
      <h2 id="board-roles" class="filter-overlay-title">Board roles</h2>
      <p class="board-type-summary">{{ purpose === 'review' ? 'Only added members can access this review board.' : 'Everyone in the workspace can view this board. Roles below grant additional permissions.' }}</p>
      <div v-if="members.length" class="board-member-list">
        <AppPersonRow
          v-for="member in members"
          :key="member.user_id"
          :name="memberName(member)"
          :avatar-url="member.allowed_users?.avatar_url"
          :fallback="memberInitial(member)"
          :role="member.role.charAt(0).toUpperCase() + member.role.slice(1)"
          :role-options="canManageMembers && member.role !== 'owner' ? memberRoleOptions : []"
          :actions="canManageMembers && member.role !== 'owner' ? [{ value: 'remove', label: 'Remove from board' }] : []"
          :role-open="memberRowRoleOpen === member.user_id"
          :actions-open="memberRowActionOpen === member.user_id"
          :disabled="busy"
          @update:role-open="memberRowRoleOpen = $event ? member.user_id : ''"
          @update:actions-open="memberRowActionOpen = $event ? member.user_id : ''"
          @select-role="updateExistingMember(member, $event)"
          @select-action="removeExistingMember(member)"
        />
      </div>
      <p v-else class="board-type-summary">{{ purpose === 'review' ? 'No board members yet.' : 'No additional board roles yet.' }}</p>
      <Transition name="member-form">
        <form v-if="canManageMembers && addingMember" class="member-form" @submit.prevent="submitMember">
          <div class="member-form-field">
            <h3>Workspace member</h3>
            <AppRolePicker
              :model-value="selectedMemberId"
              :options="workspaceMemberOptions"
              :open="memberPickerOpen"
              aria-label="Workspace member"
              @update:model-value="selectedMemberId = $event"
              @update:open="memberPickerOpen = $event"
            />
          </div>
          <div class="member-form-field">
            <h3>Board role</h3>
          <AppRolePicker
            :model-value="memberRole"
            :options="memberRoleOptions"
            :open="memberRoleOpen"
            aria-label="Board role"
            @update:model-value="setMemberRole"
            @update:open="memberRoleOpen = $event"
          />
          </div>
          <button class="panel-primary-action" type="submit" :disabled="busy">{{ busy ? 'Assigning…' : purpose === 'review' ? 'Add review member' : 'Assign board role' }}</button>
        </form>
      </Transition>
      <p v-if="canManageMembers && !availableWorkspaceMembers.length" class="board-type-summary">All eligible workspace members already have a board role.</p>
      <button v-if="canManageMembers && availableWorkspaceMembers.length" class="panel-secondary-action" type="button" :aria-expanded="addingMember" @click="toggleMemberForm">{{ addingMember ? 'Cancel' : purpose === 'review' ? 'Add review member' : 'Assign board role' }}</button>
    </section>

    <section v-if="canManageMembers && !projectBacked" class="filter-option-group danger-zone" aria-labelledby="delete-board-title">
      <h2 id="delete-board-title" class="filter-overlay-title">Delete board</h2>
      <p class="board-type-summary">This permanently removes the board, member access, and its public link.</p>
      <button class="panel-secondary-action panel-compact-action" type="button" :disabled="busy" @click="$emit('deleteBoard')">Delete board</button>
    </section>
    </template>
    <template v-else>
      <BoardAssetScopeControl v-if="purpose !== 'review'" v-model="filterDraft.assetScope" :disabled="busy" />
      <BoardFilterWidget class="board-settings-intro" :search="filterDraft.search" :project-ids="filterDraft.projectIds" :tag-ids="filterDraft.tagIds" :uploaded-bys="filterDraft.uploadedBys" :date-from="filterDraft.dateFrom" :date-to="filterDraft.dateTo" :projects="projects" :tags="tags" :submitters="submitters" :assets="draftMatchPreviews" :loading="draftMatchLoading" :asset-scope="filterDraft.assetScope" show-previews clearable :disabled="busy" @clear="clearDraftFilters" />
      <section class="filter-option-group">
        <label class="sr-only" for="board-filter-search">Search assets</label>
        <input id="board-filter-search" v-model="filterDraft.search" class="panel-field" type="search" placeholder="Search assets" :disabled="busy">
      </section>
      <section class="filter-option-group" role="group" aria-labelledby="board-filter-projects">
        <h2 id="board-filter-projects" class="filter-overlay-title">Projects</h2>
        <div class="filter-option-list">
          <button type="button" :aria-pressed="filterDraft.projectIds.length === 0" :disabled="busy" @click="filterDraft.projectIds = []">All</button>
          <button v-for="option in projects" :key="option.id" type="button" :aria-pressed="filterDraft.projectIds.includes(option.id)" :disabled="busy" @click="filterDraft.projectIds = toggleFilterOption(filterDraft.projectIds, option.id)">{{ option.name }}</button>
        </div>
      </section>
      <section class="filter-option-group" role="group" aria-labelledby="board-filter-tags">
        <h2 id="board-filter-tags" class="filter-overlay-title">Tags</h2>
        <div class="filter-option-list">
          <button type="button" :aria-pressed="filterDraft.tagIds.length === 0" :disabled="busy" @click="filterDraft.tagIds = []">All</button>
          <button v-for="option in tags" :key="option.id" type="button" :aria-pressed="filterDraft.tagIds.includes(option.id)" :disabled="busy" @click="filterDraft.tagIds = toggleFilterOption(filterDraft.tagIds, option.id)">{{ option.name }}</button>
        </div>
      </section>
      <section class="filter-option-group" role="group" aria-labelledby="board-filter-contributor">
        <h2 id="board-filter-contributor" class="filter-overlay-title">Contributor</h2>
        <div v-if="submitters.length" class="submitter-stack">
          <button
            v-for="submitter in submitters"
            :key="submitter.id"
            class="submitter-avatar"
            type="button"
            :aria-label="`Filter by ${submitterName(submitter)}`"
            :aria-pressed="filterDraft.uploadedBys.includes(submitter.id)"
            :disabled="busy"
            :title="submitterName(submitter)"
            @click="toggleSubmitterFilter(submitter.id)"
          >
            <img v-if="submitter.avatar_url" :src="submitter.avatar_url" alt="">
            <span v-else aria-hidden="true">{{ submitterInitial(submitter) }}</span>
          </button>
        </div>
        <p v-else class="board-type-summary">No contributors with assets yet.</p>
      </section>
      <section class="filter-option-group" role="group" aria-labelledby="board-filter-date">
        <h2 id="board-filter-date" class="filter-overlay-title">Date</h2>
        <div class="filter-date-range">
          <AppDatePicker v-model="filterDraft.dateFrom" label="From" :max="filterDraft.dateTo" surface="field" :disabled="busy" />
          <AppDatePicker v-model="filterDraft.dateTo" label="To" :min="filterDraft.dateFrom" surface="field" :disabled="busy" />
        </div>
      </section>
    </template>
      <AppStatusToast :message="feedback" :error="error" />
    </div>
    </Transition>
    <AppPanelActions :visible="editingFilters">
      <button class="panel-secondary-action" type="button" :disabled="busy" @click="editingFilters = false">Cancel</button>
      <button class="panel-primary-action" type="button" :disabled="busy" @click="applyFilterDraft">Apply filters</button>
    </AppPanelActions>
  </div>
</template>

<style scoped>
.board-settings-controls fieldset {
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.board-settings-actions :is(a, button) {
  min-height: var(--filter-option-height);
  padding: 0 var(--filter-option-padding);
  border: var(--filter-hairline) solid var(--filter-overlay-border-color);
  border-radius: var(--filter-pill-radius);
  color: var(--filter-overlay-panel-color);
  background: transparent;
  font: inherit;
  font-size: var(--filter-option-font-size);
  line-height: 1;
  text-decoration: none;
  opacity: 1;
}

.board-settings-actions :is(a, button) {
  border-color: var(--filter-overlay-primary-background);
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
}

.board-settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--filter-option-gap);
}

.board-public-access-heading {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--filter-option-gap);
}

.board-public-access-heading > .filter-overlay-title {
  margin: 0;
}

.board-settings-actions :is(a, button) {
  width: 100%;
  min-height: var(--filter-action-height);
  font-size: var(--filter-action-font-size);
}

.public-access-actions {
  display: inline-flex;
  flex: 0 0 auto;
  gap: var(--filter-option-gap);
  margin-inline-end: calc(var(--filter-option-padding) / 2);
  overflow: hidden;
}

.public-access-icon {
  box-sizing: border-box;
  inline-size: var(--filter-option-height);
  block-size: var(--filter-option-height);
  min-inline-size: var(--filter-option-height);
  min-block-size: var(--filter-option-height);
  max-inline-size: var(--filter-option-height);
  max-block-size: var(--filter-option-height);
  flex: 0 0 var(--filter-option-height);
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--filter-overlay-panel-color);
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 7%, transparent);
  line-height: 0;
  text-decoration: none;
  cursor: pointer;
}

.public-access-icon:hover {
  background: color-mix(in srgb, var(--filter-overlay-panel-color) 11%, transparent);
}

.public-access-icon:active {
  transform: scale(.96);
}

.public-access-icon:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.public-access-icon svg {
  fill: none;
  stroke: currentColor;
}

.public-access-icon :deep(:is(.copy-link-icon, .open-link-icon)) {
  width: 100%;
  height: 100%;
}

@media (max-width: 520px) {
  .board-public-access {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .board-public-access-heading {
    display: contents;
  }

  .board-public-access-heading > .filter-overlay-title {
    grid-column: 1 / -1;
  }

  .board-public-access > .filter-option-list--segmented {
    grid-column: 1;
    grid-row: 2;
  }

  .public-access-actions {
    grid-column: 2;
    grid-row: 2;
    margin-inline-end: 0;
  }
}

.public-access-actions-enter-active,
.public-access-actions-leave-active {
  max-width: calc(var(--filter-option-height) * 2 + var(--filter-option-gap));
  transition:
    max-width 280ms cubic-bezier(.2, .8, .2, 1),
    opacity 180ms ease,
    translate 280ms cubic-bezier(.2, .8, .2, 1);
}

.public-access-actions-enter-from,
.public-access-actions-leave-to {
  max-width: 0;
  opacity: 0;
  translate: -.375rem 0;
}

@media (prefers-reduced-motion: reduce) {
  .public-access-actions-enter-active,
  .public-access-actions-leave-active { transition: none; }
}

.board-settings-actions :is(a, button) { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }

.member-form {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space);
  padding-top: 0;
  overflow: hidden;
}

.member-form-field {
  min-width: 0;
  display: grid;
  gap: var(--filter-option-gap);
}

.member-form-enter-active,
.member-form-leave-active {
  max-height: 14rem;
  transition: max-height 260ms cubic-bezier(.2, .8, .2, 1), opacity 180ms ease, translate 260ms cubic-bezier(.2, .8, .2, 1);
}

.member-form-enter-from,
.member-form-leave-to {
  max-height: 0;
  opacity: 0;
  translate: 0 -.375rem;
}

.board-member-list {
  display: grid;
  overflow: hidden;
  border-radius: calc(var(--radius) * 2.5);
}

.board-member-list :deep(.app-person-row) {
  border-radius: 0;
  background: transparent;
}

@media (max-width: 520px) {
  .board-member-list :deep(.app-person-row) {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .board-member-list :deep(.app-person-controls) {
    grid-column: auto;
    justify-content: normal;
  }

  .board-member-list :deep(.app-person-role),
  .board-member-list :deep(.app-person-static-role) {
    width: 7.5rem;
    flex: 0 1 7.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .member-form-enter-active,
  .member-form-leave-active { transition: none; }
}
</style>
