<script setup lang="ts">
import type { BoardLayout } from '@content-library/shared'
import { ArrowUpRight, ChevronDown, Copy } from 'reicon-vue'
import { boardLayoutOptions } from '../utils/board-layouts'

const props = defineProps<{
  title: string
  purpose: 'showcase' | 'review' | 'portfolio' | 'case'
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

    <fieldset class="filter-option-group">
      <legend>Public access</legend>
      <div class="filter-option-list">
        <button type="button" :aria-pressed="!publicationEnabled" :disabled="!canEdit || busy" @click="$emit('setPublication', false)">Private</button>
        <button type="button" :aria-pressed="publicationEnabled" :disabled="!canEdit || busy" @click="$emit('setPublication', true)">Published</button>
        <Transition name="public-access-actions">
          <span v-if="publicationEnabled && publicUrl" class="public-access-actions">
            <a class="button public-access-icon" :href="publicUrl" target="_blank" rel="noopener" aria-label="Open public page in a new tab" title="Open public page"><ArrowUpRight aria-hidden="true" /></a>
            <button class="public-access-icon" type="button" aria-label="Copy public link" title="Copy public link" @click="$emit('copyLink')"><Copy aria-hidden="true" /></button>
          </span>
        </Transition>
      </div>
    </fieldset>

    <div v-if="purpose === 'portfolio' || purpose === 'review'" class="board-settings-actions">
      <NuxtLink v-if="purpose === 'portfolio' || purpose === 'review'" class="button" :to="fullSettingsUrl">{{ purpose === 'portfolio' ? 'Portfolio details and cases' : 'Open review workspace' }}</NuxtLink>
    </div>

    <fieldset class="filter-option-group">
      <legend>Public layout</legend>
      <div class="filter-option-list">
        <button v-for="option in boardLayoutOptions" :key="option.value" type="button" :aria-pressed="layout === option.value" :disabled="!canEdit || busy" @click="$emit('setLayout', option.value)">{{ option.label }}</button>
      </div>
    </fieldset>

    <section class="board-setting-group board-members">
      <div class="board-members-heading">
        <h3>Board members</h3>
        <button v-if="canManageMembers" type="button" :aria-expanded="addingMember" @click="addingMember = !addingMember">{{ addingMember ? 'Cancel' : 'Add member' }}</button>
      </div>
      <ul v-if="members.length">
        <li v-for="member in members" :key="member.user_id"><span><strong>{{ member.allowed_users?.email ?? member.allowed_users?.figma_handle ?? 'Workspace member' }}</strong><small>{{ member.role }}</small></span><button v-if="canManageMembers && member.role !== 'owner'" type="button" :disabled="busy" @click="$emit('removeMember', member.user_id)">Remove</button></li>
      </ul>
      <p v-else>No board members yet.</p>
      <Transition name="member-form">
        <form v-if="canManageMembers && addingMember" class="member-form" @submit.prevent="submitMember">
          <input v-model="memberEmail" required type="email" autocomplete="email" placeholder="Member email">
          <label class="member-role-select">
            <select v-model="memberRole" aria-label="Board role"><option value="editor">Editor</option><option value="contributor">Contributor</option><option value="viewer">Viewer</option></select>
            <ChevronDown aria-hidden="true" />
          </label>
          <button type="submit" :disabled="busy">Add member</button>
        </form>
      </Transition>
    </section>

    <section v-if="canManageMembers" class="board-setting-group danger-zone">
      <h3>Delete board</h3>
      <p>This permanently removes the board, member access, and its public link.</p>
      <button type="button" :disabled="busy" @click="$emit('deleteBoard')">Delete board</button>
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

.board-settings-controls legend,
.board-setting-group h3 {
  margin: 0 0 .625rem;
  color: inherit;
  font-size: var(--filter-option-font-size);
  font-weight: 700;
}

.board-settings-intro {
  display: grid;
  gap: .75rem;
}

.board-settings-intro .filter-overlay-title { margin: 0; }

.board-type-summary,
.board-setting-group p {
  margin: 0;
  color: rgb(255 255 255 / .58);
  font-size: var(--filter-option-font-size);
  line-height: 1.35;
}

.board-type-summary strong { color: #fff; }
.board-setting-group { display: grid; gap: .375rem; }

.board-members-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
}

.board-members-heading h3 { margin: 0; }

.board-members-heading button {
  padding: 0;
  border: 0;
  color: rgb(255 255 255 / .72);
  background: transparent;
  font: inherit;
  font-size: var(--filter-option-font-size);
  cursor: pointer;
}

.member-form :is(input, select, button),
.board-settings-actions :is(a, button),
.board-members li button,
.danger-zone > button {
  min-height: var(--filter-option-height);
  padding: 0 var(--filter-option-padding);
  border: var(--filter-hairline) solid rgb(255 255 255 / .42);
  border-radius: var(--filter-pill-radius);
  color: #fff;
  background: transparent;
  font: inherit;
  font-size: var(--filter-option-font-size);
  line-height: 1;
  text-decoration: none;
  opacity: 1;
}

.member-form button,
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
.member-form button,
.board-members li button,
.danger-zone > button { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }

.member-form {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  column-gap: var(--filter-option-gap);
  row-gap: .75rem;
  padding-top: .625rem;
  overflow: hidden;
}

.member-form :is(input, select) {
  min-width: 0;
  outline: none;
}

.member-form input {
  grid-column: 1 / -1;
  width: 100%;
}

.member-role-select {
  position: relative;
  min-width: 0;
  min-height: var(--filter-option-height);
  display: flex;
  align-items: center;
  border: var(--filter-hairline) solid rgb(255 255 255 / .42);
  border-radius: var(--filter-pill-radius);
}

.member-role-select:focus-within { border-color: #fff; }

.member-form .member-role-select select {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  appearance: none;
  border: 0;
  border-radius: inherit;
  padding-inline-start: var(--filter-option-padding);
  padding-inline-end: calc(var(--filter-option-padding) * 2 + .875rem);
  background: transparent;
}

.member-role-select svg {
  position: absolute;
  right: var(--filter-option-padding);
  width: .875rem;
  height: .875rem;
  fill: none;
  stroke: currentColor;
  pointer-events: none;
}

.member-form button { white-space: nowrap; }
.member-form input::placeholder { color: rgb(255 255 255 / .7); }
.member-form :is(input, select):focus { border-color: #fff; }

.member-form-enter-active,
.member-form-leave-active {
  max-height: 8rem;
  transition: max-height 260ms cubic-bezier(.2, .8, .2, 1), padding-top 260ms cubic-bezier(.2, .8, .2, 1), opacity 180ms ease, translate 260ms cubic-bezier(.2, .8, .2, 1);
}

.member-form-enter-from,
.member-form-leave-to {
  max-height: 0;
  padding-top: 0;
  opacity: 0;
  translate: 0 -.375rem;
}

.board-members ul {
  display: grid;
  margin: .25rem 0 0;
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
.board-members li strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.board-members li small { color: rgb(255 255 255 / .58); font-size: var(--filter-caption-size); text-transform: capitalize; }

.danger-zone {
  gap: .75rem;
  padding-top: 0;
}

.danger-zone > button {
  justify-self: start;
  margin-top: .25rem;
  border-color: rgb(255 255 255 / .72);
  color: var(--filter-overlay-primary-color);
  background: rgb(255 255 255 / .72);
}

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
  backdrop-filter: blur(1rem);
  -webkit-backdrop-filter: blur(1rem);
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

@media (max-width: 520px) {
  .member-form { grid-template-columns: 1fr; }
  .member-form :is(input, select, button) { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .member-form-enter-active,
  .member-form-leave-active,
  .board-settings-toast-enter-active,
  .board-settings-toast-leave-active { transition: none; }
}
</style>
