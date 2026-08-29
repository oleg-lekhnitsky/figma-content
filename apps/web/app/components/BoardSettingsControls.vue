<script setup lang="ts">
import type { BoardLayout } from '@content-library/shared'
import { ArrowUpRight, Copy } from 'reicon-vue'
import { boardLayoutOptions } from '../utils/board-layouts'

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
  members: Array<{ user_id: string; role: string; allowed_users: { email: string | null; figma_handle: string | null } | null }>
  feedback?: string
  error?: boolean
}>()

const memberEmail = ref('')
const memberRole = ref<'editor' | 'contributor' | 'viewer'>('contributor')
const memberRoleOpen = ref(false)
const memberRoles = ['editor', 'contributor', 'viewer'] as const
const memberRoleLabel = computed(() => memberRole.value[0]!.toUpperCase() + memberRole.value.slice(1))
const addingMember = ref(false)
const emit = defineEmits<{
  setPublication: [enabled: boolean]
  setLayout: [layout: BoardLayout]
  copyLink: []
  saveMember: [email: string, role: 'editor' | 'contributor' | 'viewer']
  removeMember: [userId: string]
  deleteBoard: []
  dismissFeedback: []
}>()
const submitMember = () => {
  const email = memberEmail.value.trim()
  if (!email) return
  emit('saveMember', email, memberRole.value)
  memberEmail.value = ''
  addingMember.value = false
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
      <p class="board-type-summary"><strong>{{ mode === 'dynamic' ? 'Dynamic board.' : 'Static board.' }}</strong> {{ mode === 'dynamic' ? 'Matching assets update automatically from filters.' : 'Assets are selected and arranged manually.' }}</p>
    </div>

    <section class="filter-option-group" role="group" aria-labelledby="board-public-access">
      <h3 id="board-public-access">Public access</h3>
      <div class="board-public-access-row">
        <div class="filter-option-list filter-option-list--segmented">
          <button type="button" :aria-pressed="!publicationEnabled" :disabled="!canEdit || busy" @click="$emit('setPublication', false)">Private</button>
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
      <h3>Board members</h3>
      <ul v-if="members.length">
        <li v-for="member in members" :key="member.user_id"><span><strong>{{ member.allowed_users?.email ?? member.allowed_users?.figma_handle ?? 'Workspace member' }}</strong><small>{{ member.role }}</small></span><button v-if="canManageMembers && member.role !== 'owner'" type="button" :disabled="busy" @click="$emit('removeMember', member.user_id)">Remove</button></li>
      </ul>
      <p v-else>No board members yet.</p>
      <Transition name="member-form">
        <form v-if="canManageMembers && addingMember" class="member-form" @submit.prevent="submitMember">
          <input v-model="memberEmail" class="panel-field" required type="email" autocomplete="email" placeholder="Member email">
          <AppDropdownMenu v-model:open="memberRoleOpen" width="anchor" content-class="panel-dropdown-menu">
            <template #trigger="{ triggerProps }">
              <button v-bind="triggerProps" class="panel-field panel-dropdown-trigger" type="button" aria-label="Board role">
                <span>{{ memberRoleLabel }}</span><span class="filter-dropdown-chevron" aria-hidden="true" />
              </button>
            </template>
            <template #default>
              <button v-for="role in memberRoles" :key="role" role="menuitemradio" :aria-checked="memberRole === role" tabindex="-1" type="button" @click="memberRole = role">{{ role[0]!.toUpperCase() + role.slice(1) }}</button>
            </template>
          </AppDropdownMenu>
          <button class="panel-primary-action" type="submit" :disabled="busy">Add member</button>
        </form>
      </Transition>
      <button v-if="canManageMembers" class="panel-secondary-action" type="button" :aria-expanded="addingMember" @click="addingMember = !addingMember">{{ addingMember ? 'Cancel' : 'Add member' }}</button>
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



.board-type-summary,
.board-setting-group p {
  margin: 0;
  color: var(--filter-overlay-muted-color);
  font-size: var(--filter-option-font-size);
  line-height: 1.35;
}

.board-type-summary strong { color: var(--filter-overlay-panel-color); }
.board-setting-group { display: grid; gap: var(--space); }

.board-settings-actions :is(a, button),
.board-members li button {
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

.board-settings-actions :is(a, button),
.board-members li button { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }

.member-form {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space);
  padding-top: 0;
  overflow: hidden;
}

.member-form input {
  min-width: 0;
  outline: none;
}

.member-form input {
  width: 100%;
}

.member-form input::placeholder { color: var(--filter-overlay-muted-color); }

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

.board-members ul {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.board-members li {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  padding: .25rem 0;
}

.board-members li > span { min-width: 0; display: flex; align-items: baseline; flex-wrap: wrap; gap: .25rem .5rem; }
.board-members li strong { overflow: hidden; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.board-members li small { color: var(--filter-overlay-muted-color); font-size: var(--filter-caption-size); text-transform: capitalize; }

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
  .member-form-enter-active,
  .member-form-leave-active,
  .board-settings-toast-enter-active,
  .board-settings-toast-leave-active { transition: none; }
}
</style>
