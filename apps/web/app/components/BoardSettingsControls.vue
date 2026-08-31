<script setup lang="ts">
import type { BoardLayout } from '@content-library/shared'
import { ArrowUpRight, Copy } from 'reicon-vue'
import { boardLayoutOptions } from '../utils/board-layouts'

interface FilterOption { id: string; name: string }
interface FilterSubmitter { id: string; figma_handle: string | null }

const props = defineProps<{
  title: string
  purpose: 'showcase' | 'review' | 'portfolio' | 'case'
  portfolioKind?: 'main' | 'client' | null
  portfolioClient?: string | null
  mode: 'dynamic' | 'static'
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
  filterUploadedBy: string | null
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
const addingMember = ref(false)
const emit = defineEmits<{
  setPublication: [enabled: boolean]
  setLayout: [layout: BoardLayout]
  'update:filterSearch': [value: string]
  'update:filterProjectIds': [value: string[]]
  'update:filterTagIds': [value: string[]]
  'update:filterUploadedBy': [value: string | null]
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
watch(() => props.title, () => { editingFilters.value = false })
const boardFilterCount = computed(() => [
  props.filterSearch,
  props.filterProjectIds.length,
  props.filterTagIds.length,
  props.filterUploadedBy,
  props.filterDateFrom || props.filterDateTo
].filter(Boolean).length)
const formatFilterDate = (value: string) => value ? value.split('-').reverse().join('.') : ''
const boardFilterSummary = computed(() => {
  const parts: string[] = []
  if (props.filterSearch) parts.push(`Search “${props.filterSearch}”`)
  const projectNames = props.projects.filter(option => props.filterProjectIds.includes(option.id)).map(option => option.name)
  if (projectNames.length) parts.push(`Projects: ${projectNames.join(', ')}`)
  const tagNames = props.tags.filter(option => props.filterTagIds.includes(option.id)).map(option => option.name)
  if (tagNames.length) parts.push(`Tags: ${tagNames.join(', ')}`)
  if (props.filterUploadedBy) {
    const submitter = props.submitters.find(option => option.id === props.filterUploadedBy)
    parts.push(`Submitter: ${submitter?.figma_handle || 'Selected contributor'}`)
  }
  if (props.filterDateFrom && props.filterDateTo) parts.push(`${formatFilterDate(props.filterDateFrom)}–${formatFilterDate(props.filterDateTo)}`)
  else if (props.filterDateFrom) parts.push(`From ${formatFilterDate(props.filterDateFrom)}`)
  else if (props.filterDateTo) parts.push(`Until ${formatFilterDate(props.filterDateTo)}`)
  return parts.join(' · ') || 'All approved assets'
})
const clearBoardFilters = () => {
  emit('update:filterSearch', '')
  emit('update:filterProjectIds', [])
  emit('update:filterTagIds', [])
  emit('update:filterUploadedBy', null)
  emit('update:filterDateFrom', '')
  emit('update:filterDateTo', '')
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
  if (feedbackTimer) clearTimeout(feedbackTimer)
})
</script>

<template>
  <div class="asset-filter-controls asset-filter-controls--expanded board-settings-controls">
    <button class="filter-sheet-handle" type="button" aria-label="Close board settings"><span aria-hidden="true" /></button>
    <div class="filter-sheet-content">
    <div class="board-settings-intro">
      <h2 class="filter-overlay-title">{{ title }}</h2>
      <p class="board-type-summary"><strong>{{ mode === 'dynamic' ? 'Smart board.' : 'Board.' }}</strong> {{ mode === 'dynamic' ? 'Matching assets appear automatically based on rules.' : 'Add and arrange assets yourself.' }}</p>
    </div>

    <section v-if="mode === 'dynamic'" class="filter-option-group board-filter-settings" role="group" aria-labelledby="board-saved-filters">
      <div class="board-filter-settings-heading">
        <h3 id="board-saved-filters">Board filters</h3>
        <button v-if="canEdit && !editingFilters" class="board-filter-change" type="button" :disabled="busy" @click="editingFilters = true">Change filters</button>
      </div>
      <p class="board-filter-summary">{{ boardFilterSummary }}</p>
      <Transition name="board-filter-editor">
        <div v-if="editingFilters" class="board-filter-editor">
          <div class="board-filter-field">
            <h4>Search</h4>
            <input class="panel-field" type="search" :value="filterSearch" placeholder="Search assets" :disabled="busy" @input="$emit('update:filterSearch', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="board-filter-field">
            <h4>Projects</h4>
            <div class="filter-option-list">
              <button type="button" :aria-pressed="filterProjectIds.length === 0" :disabled="busy" @click="$emit('update:filterProjectIds', [])">All</button>
              <button v-for="option in projects" :key="option.id" type="button" :aria-pressed="filterProjectIds.includes(option.id)" :disabled="busy" @click="$emit('update:filterProjectIds', toggleFilterOption(filterProjectIds, option.id))">{{ option.name }}</button>
            </div>
          </div>
          <div class="board-filter-field">
            <h4>Tags</h4>
            <div class="filter-option-list">
              <button type="button" :aria-pressed="filterTagIds.length === 0" :disabled="busy" @click="$emit('update:filterTagIds', [])">All</button>
              <button v-for="option in tags" :key="option.id" type="button" :aria-pressed="filterTagIds.includes(option.id)" :disabled="busy" @click="$emit('update:filterTagIds', toggleFilterOption(filterTagIds, option.id))">{{ option.name }}</button>
            </div>
          </div>
          <div v-if="submitters.length" class="board-filter-field">
            <h4>Submitter</h4>
            <div class="filter-option-list">
              <button type="button" :aria-pressed="!filterUploadedBy" :disabled="busy" @click="$emit('update:filterUploadedBy', null)">All</button>
              <button v-for="submitter in submitters" :key="submitter.id" type="button" :aria-pressed="filterUploadedBy === submitter.id" :disabled="busy" @click="$emit('update:filterUploadedBy', submitter.id)">{{ submitter.figma_handle || 'Unknown submitter' }}</button>
            </div>
          </div>
          <div class="board-filter-field">
            <h4>Date</h4>
            <div class="filter-date-range">
              <AppDatePicker :model-value="filterDateFrom" label="From" :max="filterDateTo" surface="field" :disabled="busy" @update:model-value="$emit('update:filterDateFrom', $event)" />
              <AppDatePicker :model-value="filterDateTo" label="To" :min="filterDateFrom" surface="field" :disabled="busy" @update:model-value="$emit('update:filterDateTo', $event)" />
            </div>
          </div>
          <div class="board-filter-editor-actions">
            <button v-if="boardFilterCount" class="panel-secondary-action" type="button" :disabled="busy" @click="clearBoardFilters">Clear filters</button>
            <button class="panel-primary-action" type="button" @click="editingFilters = false">Done</button>
          </div>
        </div>
      </Transition>
    </section>

    <section class="filter-option-group" role="group" aria-labelledby="board-public-access">
      <h3 id="board-public-access">Public access</h3>
      <div class="board-public-access-row">
        <div class="filter-option-list filter-option-list--segmented">
          <button type="button" :aria-pressed="!publicationEnabled" :disabled="!canEdit || busy" @click="$emit('setPublication', false)">Unpublished</button>
          <button type="button" :aria-pressed="publicationEnabled" :disabled="!canEdit || busy" @click="$emit('setPublication', true)">Published</button>
        </div>
        <Transition name="public-access-actions">
          <span v-if="publicationEnabled && publicUrl" class="public-access-actions">
            <a class="button public-access-icon" :href="publicUrl" target="_blank" rel="noopener" aria-label="Open public page in a new tab" title="Open public page"><ArrowUpRight aria-hidden="true" /></a>
            <button class="public-access-icon" type="button" aria-label="Copy public link" title="Copy public link" @click="$emit('copyLink')"><Copy aria-hidden="true" /></button>
          </span>
        </Transition>
      </div>
    </section>

    <section v-if="purpose === 'portfolio'" class="board-setting-group portfolio-summary">
      <h3>Portfolio</h3>
      <p>{{ portfolioKind === 'main' ? 'Main portfolio' : portfolioClient ? `Client portfolio · ${portfolioClient}` : 'Client portfolio' }}</p>
      <NuxtLink class="panel-secondary-action" :to="fullSettingsUrl">Manage portfolio</NuxtLink>
    </section>

    <div v-else-if="purpose === 'review'" class="board-settings-actions">
      <NuxtLink class="button" :to="fullSettingsUrl">Open review workspace</NuxtLink>
    </div>

    <section class="filter-option-group" role="group" aria-labelledby="board-public-layout">
      <h3 id="board-public-layout">Public layout</h3>
      <div class="filter-option-list filter-option-list--segmented">
        <button v-for="option in boardLayoutOptions" :key="option.value" type="button" :aria-pressed="layout === option.value" :disabled="!canEdit || busy" @click="$emit('setLayout', option.value)">{{ option.label }}</button>
      </div>
    </section>

    <section class="board-setting-group board-members">
      <h3>Board roles</h3>
      <p>{{ purpose === 'review' ? 'Only added members can access this review board.' : 'Everyone in the workspace can view this board. Roles below grant additional permissions.' }}</p>
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
      <p v-else>{{ purpose === 'review' ? 'No board members yet.' : 'No additional board roles yet.' }}</p>
      <Transition name="member-form">
        <form v-if="canManageMembers && addingMember" class="member-form" @submit.prevent="submitMember">
          <div class="member-form-field">
            <h4>Workspace member</h4>
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
            <h4>Board role</h4>
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
      <p v-if="canManageMembers && !availableWorkspaceMembers.length">All eligible workspace members already have a board role.</p>
      <button v-if="canManageMembers && availableWorkspaceMembers.length" class="panel-secondary-action" type="button" :aria-expanded="addingMember" @click="toggleMemberForm">{{ addingMember ? 'Cancel' : purpose === 'review' ? 'Add review member' : 'Assign board role' }}</button>
    </section>

    <section v-if="canManageMembers" class="board-setting-group danger-zone">
      <h3>Delete board</h3>
      <p>This permanently removes the board, member access, and its public link.</p>
      <button class="panel-secondary-action" type="button" :disabled="busy" @click="$emit('deleteBoard')">Delete board</button>
    </section>
      <Transition name="board-settings-toast">
        <p v-if="feedback" class="board-settings-feedback" :class="{ error }" role="status" aria-live="polite">{{ feedback }}</p>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.board-settings-controls fieldset {
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.board-setting-group h3 {
  margin: 0;
  color: var(--color-surface);
  font-size: var(--filter-caption-size);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
}

.board-settings-intro {
  display: grid;
  gap: .75rem;
}

.board-settings-intro .filter-overlay-title { margin: 0; }

.board-filter-settings,
.board-filter-field {
  display: grid;
  gap: var(--filter-option-gap);
}

.board-filter-settings-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--filter-option-gap);
}

.board-filter-summary {
  margin: 0;
  color: var(--filter-overlay-panel-color);
  font-size: var(--filter-option-font-size);
  line-height: 1.35;
}

.board-filter-editor {
  min-width: 0;
  display: grid;
  gap: var(--space);
  overflow: hidden;
}

.board-filter-editor-enter-active,
.board-filter-editor-leave-active {
  max-height: 60rem;
  transition:
    max-height var(--filter-action-transition-duration) var(--filter-overlay-enter-easing),
    opacity 180ms ease,
    translate var(--filter-action-transition-duration) var(--filter-overlay-enter-easing);
}

.board-filter-editor-enter-from,
.board-filter-editor-leave-to {
  max-height: 0;
  opacity: 0;
  translate: 0 calc(var(--space) * -.5);
}

.board-filter-editor .panel-field { width: 100%; min-width: 0; }

.board-filter-editor-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--filter-option-gap);
}

.board-filter-settings h4 {
  margin: 0;
  color: var(--filter-overlay-panel-color);
  font-size: var(--filter-caption-size);
  font-weight: 700;
  line-height: 1;
}

.board-filter-change {
  min-height: var(--filter-option-height);
  padding: 0 var(--filter-option-padding);
  border: var(--filter-hairline) solid var(--filter-overlay-border-color);
  border-radius: var(--filter-pill-radius);
  color: var(--filter-overlay-panel-color);
  background: transparent;
  font: inherit;
  font-size: var(--filter-option-font-size);
  cursor: pointer;
}



.board-type-summary,
.board-setting-group p {
  margin: 0;
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-option-font-size);
  line-height: 1.35;
}

.board-type-summary strong { color: var(--filter-overlay-panel-color); }
.board-setting-group { display: grid; gap: var(--space); }

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

.board-public-access-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--filter-option-gap);
}

.board-public-access-row > .filter-option-list--segmented {
  min-width: 0;
  flex: 1 1 auto;
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
  overflow: hidden;
}

.public-access-icon {
  inline-size: var(--filter-option-height);
  block-size: var(--filter-option-height);
  min-inline-size: var(--filter-option-height);
  min-block-size: var(--filter-option-height);
  flex: 0 0 var(--filter-option-height);
  padding: 0;
  display: inline-grid;
  place-items: center;
  border: var(--filter-hairline) solid var(--filter-overlay-primary-background);
  border-radius: 50%;
  color: var(--filter-overlay-primary-color);
  background: var(--filter-overlay-primary-background);
  line-height: 0;
  text-decoration: none;
  cursor: pointer;
}

.public-access-icon svg {
  width: 1em;
  height: 1em;
  font-size: var(--filter-option-font-size);
  fill: none;
  stroke: currentColor;
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

.member-form-field h4 {
  margin: 0;
  color: var(--filter-overlay-panel-color);
  font-size: var(--filter-caption-size);
  font-weight: 700;
  line-height: 1;
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

.board-member-list { display: grid; gap: var(--filter-option-gap); }

.board-settings-feedback {
  position: fixed;
  z-index: 2;
  left: 50%;
  bottom: max(1rem, env(safe-area-inset-bottom));
  width: max-content;
  max-width: calc(100vw - 2rem);
  margin: 0;
  padding: .625rem .875rem;
  border-radius: var(--filter-pill-radius);
  color: #fff;
  background: rgb(40 40 40 / .78);
  box-shadow: 0 .5rem 2rem rgb(0 0 0 / .16);
  font-size: var(--filter-option-font-size);
  line-height: 1.2;
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
  -webkit-backdrop-filter: blur(1rem);
  backdrop-filter: blur(1rem);
}

.board-settings-feedback.error { background: rgb(150 24 20 / .88); }

.board-settings-toast-enter-active,
.board-settings-toast-leave-active {
  transition: opacity 180ms ease, transform 240ms cubic-bezier(.2, .8, .2, 1);
}

.board-settings-toast-enter-from,
.board-settings-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, .5rem);
}

@media (prefers-reduced-motion: reduce) {
  .board-filter-editor-enter-active,
  .board-filter-editor-leave-active,
  .member-form-enter-active,
  .member-form-leave-active,
  .board-settings-toast-enter-active,
  .board-settings-toast-leave-active { transition: none; }
}
</style>
